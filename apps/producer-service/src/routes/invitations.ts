/**
 * Invitation Routes
 *
 * Handles team member invitations with multi-tenant support and secure token hashing.
 *
 * Endpoints:
 * - POST /api/invitations - Send invitation (Admin only)
 * - GET /api/invitations - List pending invitations (Admin only)
 * - DELETE /api/invitations/:id - Revoke invitation (Admin only)
 * - POST /api/invitations/accept - Accept invitation (Public - with token)
 * - GET /api/invitations/validate/:token - Validate token (Public)
 *
 * Security Features:
 * - Tokens stored as SHA-256 hashes (never plain text)
 * - Multi-tenant logic (existing vs. new users)
 * - Plan limit enforcement
 * - 7-day token expiration
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MongoClient, ObjectId } from 'mongodb';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import {
  generateInvitationToken,
  hashInvitationToken,
  isValidInvitationTokenFormat,
  calculateInvitationExpiration,
  isInvitationExpired,
  logInvitationCreated,
  logInvitationAccepted
} from '../utils/invitation.js';
import { sendInvitationEmail } from '../utils/email.js';

const DB_NAME = 'automation_platform';

export async function invitationRoutes(
  app: FastifyInstance,
  mongoClient: MongoClient,
  strictRateLimit: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
) {
  const db = mongoClient.db(DB_NAME);
  const invitationsCollection = db.collection('invitations');
  const usersCollection = db.collection('users');
  const orgsCollection = db.collection('organizations');

  /**
   * POST /api/invitations
   * Send invitation to join organization (Admin only)
   *
   * Request Body:
   * - email: string (valid email format)
   * - role: 'admin' | 'developer' | 'viewer'
   *
   * Response (201):
   * - success: true
   * - message: string
   * - invitation: { id, email, role, expiresAt, userExists, actionType }
   * - inviteUrl: string (for console logging in dev mode)
   *
   * Errors:
   * - 400: Missing fields, invalid email, invalid role
   * - 403: Not admin, user limit reached
   * - 409: User already in organization, pending invitation exists
   * - 500: Failed to send invitation
   */
  app.post('/api/invitations', {
    preHandler: [authMiddleware, adminOnly, strictRateLimit]
  }, async (request, reply) => {
    const { email, role } = request.body as any;
    const currentUser = request.user!;

    // Validation
    if (!email || !role) {
      return reply.code(400).send({
        success: false,
        error: 'Missing required fields',
        message: 'Email and role are required'
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

    // Validate role
    if (!['admin', 'developer', 'viewer'].includes(role)) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid role',
        message: 'Role must be admin, developer, or viewer'
      });
    }

    try {
      const orgId = new ObjectId(currentUser.organizationId);
      const org = await orgsCollection.findOne({ _id: orgId });

      if (!org) {
        return reply.code(404).send({
          success: false,
          error: 'Organization not found'
        });
      }

      // Check if user already exists in this organization
      const existingUserInOrg = await usersCollection.findOne({
        email: email.toLowerCase(),
        organizationId: orgId
      });

      if (existingUserInOrg) {
        return reply.code(409).send({
          success: false,
          error: 'User already in organization',
          message: 'This user is already a member of your organization'
        });
      }

      // Check if pending invitation already exists
      const existingInvitation = await invitationsCollection.findOne({
        email: email.toLowerCase(),
        organizationId: currentUser.organizationId,
        status: 'pending',
        expiresAt: { $gt: new Date() }
      });

      if (existingInvitation) {
        return reply.code(409).send({
          success: false,
          error: 'Invitation already sent',
          message: 'A pending invitation for this email already exists'
        });
      }

      // Check plan limits (user count)
      const currentUserCount = await usersCollection.countDocuments({
        organizationId: currentUser.organizationId
      });

      const userLimit = org.limits?.maxUsers || 3;

      if (currentUserCount >= userLimit) {
        return reply.code(403).send({
          success: false,
          error: 'User limit reached',
          message: `Your plan allows up to ${userLimit} users. Please upgrade to invite more members.`
        });
      }

      // Check if user exists in ANY organization (multi-tenant logic)
      const existingUser = await usersCollection.findOne({
        email: email.toLowerCase()
      });

      const userExists = !!existingUser;
      const actionType = userExists ? 'join' : 'signup';

      // Generate secure token
      const token = generateInvitationToken();
      const tokenHash = hashInvitationToken(token);

      // Create invitation record
      const invitationId = new ObjectId();
      const expiresAt = calculateInvitationExpiration(7);

      await invitationsCollection.insertOne({
        _id: invitationId,
        organizationId: currentUser.organizationId,
        email: email.toLowerCase(),
        role,
        tokenHash, // SECURITY: Store hash, not plain token
        status: 'pending',
        invitedBy: currentUser.userId,
        expiresAt,
        createdAt: new Date()
      });

      // Get inviter name for email
      const inviter = await usersCollection.findOne({
        _id: new ObjectId(currentUser.userId)
      });

      // Log invitation (audit trail)
      logInvitationCreated(email, currentUser.organizationId, role);

      // Send invitation email (console logging in dev mode, SendGrid in Phase 3)
      await sendInvitationEmail({
        recipientEmail: email,
        organizationName: org.name,
        inviterName: inviter?.name || 'Admin',
        role,
        inviteToken: token,
        expiresAt,
        actionType
      });

      return reply.code(201).send({
        success: true,
        message: userExists
          ? 'Invitation sent. User should login to accept.'
          : 'Invitation sent. User will create an account.',
        invitation: {
          id: invitationId.toString(),
          email: email.toLowerCase(),
          role,
          expiresAt: expiresAt.toISOString(),
          userExists,
          actionType
        }
      });

    } catch (error: any) {
      app.log.error(`Send invitation error: ${error?.message || error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to send invitation',
        message: error.message
      });
    }
  });

  /**
   * GET /api/invitations
   * List pending invitations for organization (Admin only)
   *
   * Response (200):
   * - success: true
   * - invitations: Array<{id, email, role, status, invitedBy, invitedByName, expiresAt, createdAt}>
   *
   * Errors:
   * - 401: Authentication required
   * - 403: Not admin
   * - 500: Failed to fetch invitations
   */
  app.get('/api/invitations', {
    preHandler: [authMiddleware, adminOnly]
  }, async (request, reply) => {
    try {
      const currentUser = request.user!;

      // Fetch pending invitations for organization
      const invitations = await invitationsCollection
        .find({
          organizationId: currentUser.organizationId,
          status: 'pending'
        })
        .sort({ createdAt: -1 })
        .toArray();

      // Enrich with inviter names
      const enrichedInvitations = await Promise.all(
        invitations.map(async (inv) => {
          const inviter = await usersCollection.findOne({
            _id: new ObjectId(inv.invitedBy as string)
          });

          return {
            id: inv._id.toString(),
            email: inv.email,
            role: inv.role,
            status: inv.status,
            invitedBy: inv.invitedBy,
            invitedByName: inviter?.name || 'Unknown',
            expiresAt: inv.expiresAt,
            createdAt: inv.createdAt
          };
        })
      );

      return reply.send({
        success: true,
        invitations: enrichedInvitations
      });

    } catch (error: any) {
      app.log.error(`List invitations error: ${error?.message || error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch invitations',
        message: error.message
      });
    }
  });

  /**
   * DELETE /api/invitations/:id
   * Revoke pending invitation (Admin only)
   *
   * Response (200):
   * - success: true
   * - message: string
   *
   * Errors:
   * - 401: Authentication required
   * - 403: Not admin
   * - 404: Invitation not found
   * - 500: Failed to revoke invitation
   */
  app.delete('/api/invitations/:id', {
    preHandler: [authMiddleware, adminOnly]
  }, async (request, reply) => {
    const { id } = request.params as any;
    const currentUser = request.user!;

    try {
      // Validate ObjectId format
      if (!ObjectId.isValid(id)) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid invitation ID'
        });
      }

      // Delete invitation (only if belongs to user's organization)
      const result = await invitationsCollection.deleteOne({
        _id: new ObjectId(id),
        organizationId: currentUser.organizationId
      });

      if (result.deletedCount === 0) {
        return reply.code(404).send({
          success: false,
          error: 'Invitation not found'
        });
      }

      app.log.info(`Invitation revoked: ${id} by ${currentUser.userId}`);

      return reply.send({
        success: true,
        message: 'Invitation revoked successfully'
      });

    } catch (error: any) {
      app.log.error(`Revoke invitation error: ${error?.message || error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to revoke invitation',
        message: error.message
      });
    }
  });

  /**
   * GET /api/invitations/validate/:token
   * Validate invitation token (Public endpoint)
   *
   * Response (200):
   * - success: true
   * - valid: boolean
   * - organizationName?: string
   * - role?: string
   * - inviterName?: string
   * - userExists?: boolean
   *
   * Errors:
   * - 400: Invalid token format
   * - 404: Token not found or expired
   * - 500: Validation failed
   */
  app.get('/api/invitations/validate/:token', async (request, reply) => {
    const { token } = request.params as any;

    try {
      // Validate token format
      if (!isValidInvitationTokenFormat(token)) {
        return reply.code(400).send({
          success: false,
          valid: false,
          error: 'Invalid token format'
        });
      }

      // Hash token to look up in database
      const tokenHash = hashInvitationToken(token);

      // Find invitation
      const invitation = await invitationsCollection.findOne({
        tokenHash,
        status: 'pending'
      });

      if (!invitation) {
        return reply.code(404).send({
          success: false,
          valid: false,
          error: 'Invitation not found or already used'
        });
      }

      // Check if expired
      if (isInvitationExpired(invitation.expiresAt as Date)) {
        // Mark as expired
        await invitationsCollection.updateOne(
          { _id: invitation._id },
          { $set: { status: 'expired' } }
        );

        return reply.code(404).send({
          success: false,
          valid: false,
          error: 'Invitation has expired'
        });
      }

      // Get organization and inviter details
      const org = await orgsCollection.findOne({
        _id: new ObjectId(invitation.organizationId as string)
      });

      const inviter = await usersCollection.findOne({
        _id: new ObjectId(invitation.invitedBy as string)
      });

      // Check if user exists
      const existingUser = await usersCollection.findOne({
        email: invitation.email
      });

      return reply.send({
        success: true,
        valid: true,
        organizationName: org?.name || 'Unknown Organization',
        role: invitation.role,
        inviterName: inviter?.name || 'Unknown',
        userExists: !!existingUser
      });

    } catch (error: any) {
      app.log.error(`Validate invitation error: ${error?.message || error}`);
      return reply.code(500).send({
        success: false,
        valid: false,
        error: 'Failed to validate invitation',
        message: error.message
      });
    }
  });

  /**
   * POST /api/invitations/accept
   * Accept invitation (for existing users who login first)
   *
   * Request Body:
   * - token: string (invitation token)
   *
   * Response (200):
   * - success: true
   * - message: string
   * - organization: { id, name }
   *
   * Errors:
   * - 400: Missing token, invalid format
   * - 401: Authentication required
   * - 403: Email mismatch
   * - 404: Invalid or expired token
   * - 500: Failed to accept invitation
   */
  app.post('/api/invitations/accept', {
    preHandler: authMiddleware
  }, async (request, reply) => {
    const { token } = request.body as any;
    const currentUser = request.user!;

    try {
      // Validation
      if (!token) {
        return reply.code(400).send({
          success: false,
          error: 'Missing token',
          message: 'Invitation token is required'
        });
      }

      // Validate token format
      if (!isValidInvitationTokenFormat(token)) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid token format'
        });
      }

      // Hash token to look up in database
      const tokenHash = hashInvitationToken(token);

      // Find invitation
      const invitation = await invitationsCollection.findOne({
        tokenHash,
        status: 'pending'
      });

      if (!invitation) {
        return reply.code(404).send({
          success: false,
          error: 'Invalid or expired invitation'
        });
      }

      // Check if expired
      if (isInvitationExpired(invitation.expiresAt as Date)) {
        await invitationsCollection.updateOne(
          { _id: invitation._id },
          { $set: { status: 'expired' } }
        );

        return reply.code(404).send({
          success: false,
          error: 'Invitation has expired'
        });
      }

      // Verify email matches current user
      const user = await usersCollection.findOne({
        _id: new ObjectId(currentUser.userId)
      });

      if (!user || user.email !== invitation.email) {
        return reply.code(403).send({
          success: false,
          error: 'Email mismatch',
          message: 'This invitation is for a different email address'
        });
      }

      // Update user's organization and role
      await usersCollection.updateOne(
        { _id: new ObjectId(currentUser.userId) },
        {
          $set: {
            organizationId: new ObjectId(invitation.organizationId as string),
            role: invitation.role,
            updatedAt: new Date()
          }
        }
      );

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

      // Get organization details
      const org = await orgsCollection.findOne({
        _id: new ObjectId(invitation.organizationId as string)
      });

      // Log acceptance
      logInvitationAccepted(invitation.email as string, invitation.organizationId as string);

      app.log.info(`Invitation accepted: ${user.email} joined ${org?.name}`);

      return reply.send({
        success: true,
        message: `Successfully joined ${org?.name || 'organization'}`,
        organization: {
          id: org?._id.toString(),
          name: org?.name
        }
      });

    } catch (error: any) {
      app.log.error(`Accept invitation error: ${error?.message || error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to accept invitation',
        message: error.message
      });
    }
  });

  app.log.info('✅ Invitation routes registered');
  app.log.info('  - POST /api/invitations (Admin only)');
  app.log.info('  - GET /api/invitations (Admin only)');
  app.log.info('  - DELETE /api/invitations/:id (Admin only)');
  app.log.info('  - GET /api/invitations/validate/:token (Public)');
  app.log.info('  - POST /api/invitations/accept (Authenticated)');
}
