/**
 * Authentication Routes
 *
 * Provides signup, login, and user info endpoints for multi-tenant authentication.
 *
 * Endpoints:
 * - POST /api/auth/signup - Register new user and create organization
 * - POST /api/auth/login - Authenticate user and return JWT
 * - GET /api/auth/me - Get current user info from JWT token
 * - POST /api/auth/logout - Logout (client-side token removal, placeholder for token blacklist)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MongoClient, ObjectId } from 'mongodb';
import Redis from 'ioredis';
import { hashPassword, comparePassword, validatePasswordStrength } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import { authMiddleware } from '../middleware/auth.js';
import { hashInvitationToken, isValidInvitationTokenFormat, isInvitationExpired } from '../utils/invitation.js';
import { sendWelcomeEmail } from '../utils/email.js';
import { createApiKey, listApiKeys, revokeApiKey } from '../utils/apiKeys.js';

const DB_NAME = 'automation_platform';

export async function authRoutes(
  app: FastifyInstance,
  mongoClient: MongoClient,
  authRateLimit: (request: FastifyRequest, reply: FastifyReply) => Promise<void>,
  redis: Redis
) {
  const db = mongoClient.db(DB_NAME);
  const usersCollection = db.collection('users');
  const orgsCollection = db.collection('organizations');
  const invitationsCollection = db.collection('invitations');

  /**
   * POST /api/auth/signup
   * Register new user and create organization (or join via invitation)
   *
   * Request Body:
   * - email: string (valid email format)
   * - password: string (min 8 chars, uppercase, lowercase, number, special char)
   * - name: string (user's full name)
   * - organizationName?: string (organization name - required ONLY if no inviteToken)
   * - inviteToken?: string (optional - for invited users)
   *
   * Response (201):
   * - success: true
   * - token: string (JWT token)
   * - user: { id, email, name, role, organizationId, organizationName }
   *
   * Errors:
   * - 400: Missing fields, invalid email, weak password, invalid invitation
   * - 409: Email already registered
   * - 500: Signup failed
   * - 429: Rate limit exceeded (5 attempts per minute)
   */
  app.post('/api/auth/signup', { preHandler: authRateLimit }, async (request, reply) => {
    const { email, password, name, organizationName, inviteToken } = request.body as any;

    // Validation
    if (!email || !password || !name) {
      return reply.code(400).send({
        success: false,
        error: 'Missing required fields',
        message: 'Email, password, and name are required'
      });
    }

    // If no inviteToken, organizationName is required
    if (!inviteToken && !organizationName) {
      return reply.code(400).send({
        success: false,
        error: 'Missing required fields',
        message: 'Organization name is required when not using an invitation'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return reply.code(400).send({
        success: false,
        error: 'Weak password',
        message: passwordValidation.errors.join(', ')
      });
    }

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return reply.code(409).send({
        success: false,
        error: 'Email already registered',
        message: 'An account with this email already exists'
      });
    }

    try {
      let orgId: ObjectId;
      let userRole: string;
      let orgName: string;

      // INVITATION FLOW: User signing up with invitation token
      if (inviteToken) {
        // Validate token format
        if (!isValidInvitationTokenFormat(inviteToken)) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid invitation token format'
          });
        }

        // Hash token to look up in database
        const tokenHash = hashInvitationToken(inviteToken);

        // Find invitation
        const invitation = await invitationsCollection.findOne({
          tokenHash,
          email: email.toLowerCase(),
          status: 'pending'
        });

        if (!invitation) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid or expired invitation',
            message: 'The invitation token is invalid or has already been used'
          });
        }

        // Check if expired
        if (isInvitationExpired(invitation.expiresAt as Date)) {
          await invitationsCollection.updateOne(
            { _id: invitation._id },
            { $set: { status: 'expired' } }
          );

          return reply.code(400).send({
            success: false,
            error: 'Invitation has expired',
            message: 'This invitation has expired. Please request a new invitation.'
          });
        }

        // Use invitation's organization and role
        orgId = new ObjectId(invitation.organizationId as string);
        userRole = invitation.role as string;

        // Get organization name
        const org = await orgsCollection.findOne({ _id: orgId });
        orgName = org?.name || 'Unknown Organization';

        // Create user
        const userId = new ObjectId();
        const hashedPassword = await hashPassword(password);

        await usersCollection.insertOne({
          _id: userId,
          email: email.toLowerCase(),
          name,
          hashedPassword,
          organizationId: orgId,
          role: userRole,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // Mark invitation as accepted
        await invitationsCollection.updateOne(
          { _id: invitation._id },
          {
            $set: {
              status: 'accepted',
              acceptedAt: new Date()
            }
          }
        );

        // Generate JWT token
        const token = signToken({
          userId: userId.toString(),
          email: email.toLowerCase(),
          organizationId: orgId.toString(),
          role: userRole
        });

        app.log.info(`User accepted invitation: ${email} joined ${orgName} as ${userRole}`);

        // Send welcome email (non-blocking)
        sendWelcomeEmail(
          email.toLowerCase(),
          name,
          orgName,
          userRole as 'admin' | 'developer' | 'viewer',
          false // joining existing organization
        ).catch((error: any) => {
          app.log.error(`Failed to send welcome email to ${email}: ${error?.message || error}`);
        });

        return reply.code(201).send({
          success: true,
          token,
          user: {
            id: userId.toString(),
            email: email.toLowerCase(),
            name,
            role: userRole,
            organizationId: orgId.toString(),
            organizationName: orgName
          }
        });
      } else {
        // REGULAR FLOW: Create new organization
        orgId = new ObjectId();
        const slug = organizationName
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');

        await orgsCollection.insertOne({
          _id: orgId,
          name: organizationName,
          slug,
          plan: 'free',
          limits: {
            maxProjects: 1,
            maxTestRuns: 100,
            maxUsers: 3,
            maxConcurrentRuns: 1
          },
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // Create user
        const userId = new ObjectId();
        const hashedPassword = await hashPassword(password);

        await usersCollection.insertOne({
          _id: userId,
          email: email.toLowerCase(),
          name,
          hashedPassword,
          organizationId: orgId,
          role: 'admin',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // Generate JWT token
        const token = signToken({
          userId: userId.toString(),
          email: email.toLowerCase(),
          organizationId: orgId.toString(),
          role: 'admin'
        });

        app.log.info(`New organization created: ${organizationName} (${orgId})`);
        app.log.info(`New user registered: ${email} (${userId})`);

        // Send welcome email (non-blocking)
        sendWelcomeEmail(
          email.toLowerCase(),
          name,
          organizationName,
          'admin',
          true // new organization
        ).catch((error: any) => {
          app.log.error(`Failed to send welcome email to ${email}: ${error?.message || error}`);
        });

        return reply.code(201).send({
          success: true,
          token,
          user: {
            id: userId.toString(),
            email: email.toLowerCase(),
            name,
            role: 'admin',
            organizationId: orgId.toString(),
            organizationName
          }
        });
      }

    } catch (error: any) {
      app.log.error(`Signup error: ${error?.message || error}`);
      return reply.code(500).send({
        success: false,
        error: 'Signup failed',
        message: error.message
      });
    }
  });

  /**
   * POST /api/auth/login
   * Authenticate user and return JWT token
   *
   * Request Body:
   * - email: string
   * - password: string
   *
   * Response (200):
   * - success: true
   * - token: string (JWT token)
   * - user: { id, email, name, role, organizationId, organizationName }
   *
   * Errors:
   * - 400: Missing credentials
   * - 401: Invalid credentials
   * - 403: Account suspended
   * - 429: Rate limit exceeded (5 attempts per minute)
   * - 500: Login failed
   */
  app.post('/api/auth/login', { preHandler: authRateLimit }, async (request, reply) => {
    const { email, password } = request.body as any;

    if (!email || !password) {
      return reply.code(400).send({
        success: false,
        error: 'Missing credentials',
        message: 'Email and password are required'
      });
    }

    try {
      const normalizedEmail = email.toLowerCase();

      // Task 4.3: Check if account is locked due to failed login attempts
      const lockKey = `login_lock:${normalizedEmail}`;
      const isLocked = await redis.exists(lockKey);

      if (isLocked) {
        const ttl = await redis.ttl(lockKey);
        const minutesRemaining = Math.ceil(ttl / 60);

        app.log.warn({
          event: 'LOGIN_ATTEMPT_WHILE_LOCKED',
          email: normalizedEmail,
          ip: request.ip,
          minutesRemaining
        });

        return reply.code(429).send({
          success: false,
          error: 'Account temporarily locked',
          message: `Too many failed login attempts. Please try again in ${minutesRemaining} minute(s).`,
          retryAfter: ttl
        });
      }

      // Find user
      const user = await usersCollection.findOne({ email: normalizedEmail });
      if (!user) {
        // Task 4.3: Track failed attempt (invalid email)
        const failKey = `login_failures:${normalizedEmail}`;
        const failedAttempts = await redis.incr(failKey);
        await redis.expire(failKey, 900); // 15 minute window

        // Lock account after 5 failed attempts
        if (failedAttempts >= 5) {
          await redis.setex(lockKey, 900, '1'); // Lock for 15 minutes

          app.log.warn({
            event: 'ACCOUNT_LOCKED',
            email: normalizedEmail,
            ip: request.ip,
            attempts: failedAttempts
          });
        }

        return reply.code(401).send({
          success: false,
          error: 'Invalid credentials',
          message: 'Email or password is incorrect',
          attemptsRemaining: Math.max(0, 5 - failedAttempts)
        });
      }

      // Verify password
      const isValidPassword = await comparePassword(password, user.hashedPassword as string);
      if (!isValidPassword) {
        // Task 4.3: Track failed attempt (invalid password)
        const failKey = `login_failures:${normalizedEmail}`;
        const failedAttempts = await redis.incr(failKey);
        await redis.expire(failKey, 900); // 15 minute window

        // Lock account after 5 failed attempts
        if (failedAttempts >= 5) {
          await redis.setex(lockKey, 900, '1'); // Lock for 15 minutes

          app.log.warn({
            event: 'ACCOUNT_LOCKED',
            email: normalizedEmail,
            ip: request.ip,
            attempts: failedAttempts
          });
        }

        return reply.code(401).send({
          success: false,
          error: 'Invalid credentials',
          message: 'Email or password is incorrect',
          attemptsRemaining: Math.max(0, 5 - failedAttempts)
        });
      }

      // Task 4.3: Successful login - clear failed attempts
      const failKey = `login_failures:${normalizedEmail}`;
      await redis.del(failKey);
      await redis.del(lockKey);

      // Check user status
      if (user.status === 'suspended') {
        return reply.code(403).send({
          success: false,
          error: 'Account suspended',
          message: 'Your account has been suspended. Contact support.'
        });
      }

      // Get organization
      const org = await orgsCollection.findOne({ _id: user.organizationId as ObjectId });

      // Generate JWT token
      const token = signToken({
        userId: user._id.toString(),
        email: user.email,
        organizationId: (user.organizationId as ObjectId).toString(),
        role: user.role as string
      });

      // Update last login timestamp
      await usersCollection.updateOne(
        { _id: user._id },
        { $set: { lastLoginAt: new Date() } }
      );

      app.log.info({
        event: 'LOGIN_SUCCESS',
        email: user.email,
        userId: user._id.toString(),
        ip: request.ip
      });

      return reply.send({
        success: true,
        token,
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: (user.organizationId as ObjectId).toString(),
          organizationName: org?.name || 'Unknown Organization'
        }
      });

    } catch (error: any) {
      app.log.error(`Login error: ${error?.message || error}`);
      return reply.code(500).send({
        success: false,
        error: 'Login failed',
        message: error.message
      });
    }
  });

  /**
   * GET /api/auth/me
   * Get current user info from JWT token
   *
   * Headers:
   * - Authorization: Bearer <token>
   *
   * Response (200):
   * - success: true
   * - data: {
   *     id, email, name, role, status, lastLoginAt,
   *     organization: { id, name, slug, plan, limits }
   *   }
   *
   * Errors:
   * - 401: Authentication required / Invalid token
   * - 404: User or organization not found
   * - 500: Failed to fetch user info
   */
  app.get('/api/auth/me', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const userId = new ObjectId(request.user!.userId);
      const orgId = new ObjectId(request.user!.organizationId);

      const user = await usersCollection.findOne({ _id: userId });
      const org = await orgsCollection.findOne({ _id: orgId });

      if (!user || !org) {
        return reply.code(404).send({
          success: false,
          error: 'User or organization not found'
        });
      }

      // Count active users in organization
      const userCount = await usersCollection.countDocuments({
        organizationId: orgId
      });

      // Calculate user limit based on plan
      const userLimit = org.limits?.maxUsers || (
        org.plan === 'free' ? 3 :
          org.plan === 'team' ? 20 :
            999 // enterprise
      );

      return reply.send({
        success: true,
        data: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          lastLoginAt: user.lastLoginAt,
          organization: {
            id: org._id.toString(),
            name: org.name,
            slug: org.slug,
            plan: org.plan,
            limits: org.limits,
            userCount,      // NEW: current active users
            userLimit,      // NEW: max users allowed
            aiAnalysisEnabled: org.aiAnalysisEnabled !== false  // NEW: default true
          }
        }
      });

    } catch (error: any) {
      app.log.error(`Get user error: ${error?.message || error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch user info',
        message: error.message
      });
    }
  });

  /**
   * PATCH /api/auth/profile
   * Update current user's profile (name only)
   *
   * Headers:
   * - Authorization: Bearer <token>
   *
   * Request Body:
   * - name: string (user's new name)
   *
   * Response (200):
   * - success: true
   * - message: string
   * - user: { id, name, email, role }
   *
   * Errors:
   * - 400: Missing or invalid name
   * - 401: Authentication required
   * - 500: Failed to update profile
   */
  app.patch('/api/auth/profile', { preHandler: authMiddleware }, async (request, reply) => {
    const { name } = request.body as { name?: string };
    const currentUser = request.user!;

    try {
      // Validate name
      if (!name || typeof name !== 'string') {
        return reply.code(400).send({
          success: false,
          error: 'Missing required field',
          message: 'Name is required'
        });
      }

      const trimmedName = name.trim();
      if (trimmedName.length === 0) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid name',
          message: 'Name cannot be empty'
        });
      }

      if (trimmedName.length > 100) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid name',
          message: 'Name cannot exceed 100 characters'
        });
      }

      // Update user in database
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(currentUser.userId) },
        {
          $set: {
            name: trimmedName,
            updatedAt: new Date()
          }
        }
      );

      if (result.modifiedCount === 0) {
        return reply.code(500).send({
          success: false,
          error: 'Update failed',
          message: 'Failed to update profile'
        });
      }

      app.log.info(`Profile updated: ${currentUser.userId} changed name to "${trimmedName}"`);

      return reply.send({
        success: true,
        message: 'Profile updated successfully',
        user: {
          id: currentUser.userId,
          name: trimmedName,
          email: currentUser.email,
          role: currentUser.role
        }
      });

    } catch (error: any) {
      app.log.error(`Profile update error: ${error?.message || error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to update profile',
        message: error.message
      });
    }
  });

  /**
   * POST /api/auth/logout
   * Logout user (client-side token removal, placeholder for future token blacklist)
   *
   * Headers:
   * - Authorization: Bearer <token>
   *
   * Response (200):
   * - success: true
   * - message: "Logged out successfully"
   *
   * Note: In a stateless JWT system, logout is handled client-side.
   * Future enhancement: Implement token blacklist in Redis.
   */
  app.post('/api/auth/logout', { preHandler: authMiddleware }, async (request, reply) => {
    // In a stateless JWT system, logout is handled client-side
    // Future: Implement token blacklist in Redis
    app.log.info(`User logged out: ${request.user!.userId}`);

    return reply.send({
      success: true,
      message: 'Logged out successfully'
    });
  });

  // ===================================================================
  // API Key Management Routes
  // ===================================================================

  /**
   * POST /api/auth/api-keys
   * Generate a new API key for CI/CD integration
   *
   * Headers:
   * - Authorization: Bearer <token>
   *
   * Request Body:
   * - name: string (optional, default: "Unnamed Key")
   *
   * Response (201):
   * - success: true
   * - apiKey: string (FULL KEY - shown only once)
   * - data: { id, name, prefix, createdAt }
   *
   * IMPORTANT: The full API key is only returned once. Store it securely.
   */
  app.post('/api/auth/api-keys', { preHandler: authMiddleware }, async (request, reply) => {
    const { name } = request.body as { name?: string };
    const currentUser = request.user!;

    try {
      const { fullKey, keyData } = await createApiKey(
        new ObjectId(currentUser.userId),
        new ObjectId(currentUser.organizationId),
        name || 'Unnamed Key',
        db
      );

      app.log.info(`API key created: ${currentUser.userId} created key ${keyData.prefix}`);

      return reply.code(201).send({
        success: true,
        message: 'API key created. Store this key securely - it will not be shown again.',
        apiKey: fullKey,
        data: {
          id: keyData._id?.toString(),
          name: keyData.name,
          prefix: keyData.prefix,
          createdAt: keyData.createdAt
        }
      });

    } catch (error: any) {
      app.log.error(`API key creation error: ${error?.message || error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to create API key',
        message: error.message
      });
    }
  });

  /**
   * GET /api/auth/api-keys
   * List all API keys for the current user
   *
   * Headers:
   * - Authorization: Bearer <token>
   *
   * Response (200):
   * - success: true
   * - data: Array<{ id, name, prefix, createdAt, lastUsed }>
   *
   * Note: Full key is never returned - only prefix for identification.
   */
  app.get('/api/auth/api-keys', { preHandler: authMiddleware }, async (request, reply) => {
    const currentUser = request.user!;

    try {
      const keys = await listApiKeys(
        new ObjectId(currentUser.userId),
        db
      );

      const keyList = keys.map(key => ({
        id: key._id?.toString(),
        name: key.name,
        prefix: key.prefix,
        createdAt: key.createdAt,
        lastUsed: key.lastUsed
      }));

      return reply.send({
        success: true,
        data: keyList
      });

    } catch (error: any) {
      app.log.error(`API key list error: ${error?.message || error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to list API keys',
        message: error.message
      });
    }
  });

  /**
   * DELETE /api/auth/api-keys/:id
   * Revoke (delete) an API key
   *
   * Headers:
   * - Authorization: Bearer <token>
   *
   * Params:
   * - id: string (API key ObjectId)
   *
   * Response (200):
   * - success: true
   * - message: "API key revoked"
   *
   * Errors:
   * - 404: API key not found or not owned by user
   */
  app.delete('/api/auth/api-keys/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = request.user!;

    try {
      if (!ObjectId.isValid(id)) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid key ID'
        });
      }

      const deleted = await revokeApiKey(
        new ObjectId(id),
        new ObjectId(currentUser.userId),
        db
      );

      if (!deleted) {
        return reply.code(404).send({
          success: false,
          error: 'API key not found',
          message: 'The API key does not exist or you do not have permission to delete it.'
        });
      }

      app.log.info(`API key revoked: ${currentUser.userId} deleted key ${id}`);

      return reply.send({
        success: true,
        message: 'API key revoked successfully'
      });

    } catch (error: any) {
      app.log.error(`API key revoke error: ${error?.message || error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to revoke API key',
        message: error.message
      });
    }
  });

  app.log.info('✅ Authentication routes registered');
  app.log.info('  - POST /api/auth/signup');
  app.log.info('  - POST /api/auth/login');
  app.log.info('  - GET /api/auth/me');
  app.log.info('  - POST /api/auth/logout');
  app.log.info('  - POST /api/auth/api-keys');
  app.log.info('  - GET /api/auth/api-keys');
  app.log.info('  - DELETE /api/auth/api-keys/:id');
}
