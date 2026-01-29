import { z } from 'zod';
import { ObjectId } from 'mongodb';

// ============================================================================
// ZOD VALIDATION SCHEMAS (existing)
// ============================================================================

export const ExecutionConfigSchema = z.object({
    project: z.string().optional(),
    environment: z.enum(['development', 'staging', 'production']),
    baseUrl: z.url().optional(),
    retryAttempts: z.number().min(0).max(5).default(2),
    // Allows users to pass custom environment variables to their containers
    envVars: z.record(z.string(), z.string()).optional()
});

export const TestExecutionRequestSchema = z.object({
    taskId: z.string().min(1),
    image: z.string().min(1).default('mcr.microsoft.com/playwright:v1.57.0-jammy'),
    folder: z.string().optional().default('all'),
    command: z.string().min(1),
    tests: z.array(z.string().min(1)).optional(),
    config: ExecutionConfigSchema,
    executionId: z.string().uuid().optional(),
});

export type TestExecutionRequest = z.infer<typeof TestExecutionRequestSchema>;

// ============================================================================
// MULTI-TENANT INTERFACES (Phase 1)
// ============================================================================

/**
 * Organization entity
 * Represents a tenant in the multi-tenant system
 */
export interface IOrganization {
    _id: ObjectId;
    name: string;
    slug: string; // URL-friendly unique identifier
    plan: 'free' | 'team' | 'enterprise';
    limits: {
        maxProjects: number;
        maxTestRuns: number;
        maxUsers: number;
        maxConcurrentRuns: number;
    };
    createdAt: Date;
    updatedAt: Date;
}

/**
 * User entity
 * Represents a user belonging to an organization
 */
export interface IUser {
    _id: ObjectId;
    email: string;
    name: string;
    hashedPassword: string;
    organizationId: ObjectId;
    role: 'admin' | 'developer' | 'viewer';
    status: 'active' | 'invited' | 'suspended';
    invitedBy?: ObjectId;
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Invitation entity
 * Represents a pending invitation to join an organization
 */
export interface IInvitation {
    _id: ObjectId;
    organizationId: ObjectId;
    email: string;
    role: 'admin' | 'developer' | 'viewer';
    token: string; // Secure random token for signup link
    status: 'pending' | 'accepted' | 'expired' | 'revoked';
    invitedBy: ObjectId;
    expiresAt: Date;
    createdAt: Date;
    acceptedAt?: Date;
}

/**
 * JWT Token Payload
 * Contains user and organization context
 */
export interface IJWTPayload {
    userId: string;
    organizationId: string;
    role: string;
    iat: number; // Issued at
    exp: number; // Expiration
}

/**
 * Execution Configuration
 */
export interface IExecutionConfig {
    project?: string;
    environment: 'development' | 'staging' | 'production';
    baseUrl?: string;
    retryAttempts: number;
    envVars?: Record<string, string>;
}

/**
 * Test Execution entity
 * Represents a single test run (now multi-tenant aware)
 */
export interface IExecution {
    _id: ObjectId;
    organizationId: ObjectId; // ← NEW: Multi-tenant isolation
    taskId: string;
    status: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR' | 'UNSTABLE' | 'ANALYZING';
    image: string;
    command: string;
    folder: string;
    startTime: Date;
    endTime?: Date;
    config: IExecutionConfig;
    tests: string[];
    output?: string;
    error?: string;
    analysis?: string;
    reportsBaseUrl?: string;
}

// ============================================================================
// AUTH API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Signup request payload
 */
export interface ISignupRequest {
    email: string;
    password: string;
    name: string;
    organizationName: string;
}

/**
 * Login request payload
 */
export interface ILoginRequest {
    email: string;
    password: string;
}

/**
 * Authentication response
 * Returned by both signup and login endpoints
 */
export interface IAuthResponse {
    success: boolean;
    token: string;
    user: {
        id: string;
        email: string;
        name: string;
        role: string;
        organizationId: string;
        organizationName: string;
    };
}

/**
 * User info response (from /api/auth/me)
 */
export interface IUserInfoResponse {
    success: boolean;
    data: {
        id: string;
        email: string;
        name: string;
        role: string;
        status: string;
        lastLoginAt?: Date;
        organization: {
            id: string;
            name: string;
            slug: string;
            plan: string;
            limits: {
                maxProjects: number;
                maxTestRuns: number;
                maxUsers: number;
                maxConcurrentRuns: number;
            };
        };
    };
}

// ============================================================================
// TYPE EXPORTS FOR CONVENIENCE
// ============================================================================

export type UserRole = 'admin' | 'developer' | 'viewer';
export type UserStatus = 'active' | 'invited' | 'suspended';
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export type OrganizationPlan = 'free' | 'team' | 'enterprise';
export type ExecutionStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR' | 'UNSTABLE' | 'ANALYZING';