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

export const CiTriggerSourceSchema = z.enum([
    'manual', 'cron', 'github', 'gitlab', 'jenkins', 'webhook',
]);

export type CiTriggerSource = z.infer<typeof CiTriggerSourceSchema>;

/**
 * Supported automation frameworks.
 * 'maestro' is a mobile-native framework (stub — Sprint 9 will wire the full execution path).
 */
export const AutomationFrameworkSchema = z.enum([
    'playwright',
    'pytest',
    'cypress',
    'maestro',
]);

export type AutomationFramework = z.infer<typeof AutomationFrameworkSchema>;

export const TestExecutionRequestSchema = z.object({
    taskId: z.string().min(1),
    image: z.string().min(1).default('mcr.microsoft.com/playwright:v1.57.0-jammy'),
    folder: z.string().optional().default('all'),
    command: z.string().min(1),
    tests: z.array(z.string().min(1)).optional(),
    config: ExecutionConfigSchema,
    executionId: z.string().uuid().optional(),
    /** Optional: logical run group name (e.g. "Daily Sanity", "Regression Suite"). */
    groupName: z.string().max(128).optional(),
    /** Optional: shared identifier that links runs triggered in the same CI batch. */
    batchId: z.string().max(128).optional(),
    /** Optional: CI/CD source override — detected from headers when omitted. */
    trigger: CiTriggerSourceSchema.optional(),
    /** Optional: automation framework hint — used by the worker to select the correct execution path. */
    framework: AutomationFrameworkSchema.optional(),
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
    /** Optional Slack incoming webhook URL for execution notifications. */
    slackWebhookUrl?: string;
    /** Per-organization feature flags to selectively enable/disable modules. */
    features?: {
        testCasesEnabled: boolean;
        testCyclesEnabled: boolean;
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
    tokenHash: string; // SHA-256 hash of invitation token (SECURITY: never store plain token)
    status: 'pending' | 'accepted' | 'expired';
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
    /** Logical run-group label supplied at trigger time (e.g. "Daily Sanity"). */
    groupName?: string;
    /** CI-level batch identifier shared by runs triggered together. */
    batchId?: string;
    /** Source that triggered this execution. */
    trigger?: CiTriggerSource;
    /** Automation framework used for this execution. */
    framework?: AutomationFramework;
}

// ============================================================================
// PROJECT & RUN SETTINGS INTERFACES
// ============================================================================

/**
 * Project entity
 * Represents an automation project belonging to an organization
 */
export interface IProject {
    _id: ObjectId;
    organizationId: string;
    name: string;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Project Run Settings entity
 * Per-project configuration for test execution defaults.
 * If projectId is undefined, represents org-level defaults.
 */
export interface IProjectRunSettings {
    _id: ObjectId;
    organizationId: string;
    projectId?: string;
    dockerImage: string;
    targetUrls: {
        dev?: string;
        staging?: string;
        prod?: string;
    };
    defaultTestFolder: string;
    updatedAt: Date;
    updatedBy: string;
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
// INVITATION API REQUEST/RESPONSE TYPES (Phase 2)
// ============================================================================

/**
 * Invitation request payload
 */
export interface IInvitationRequest {
    email: string;
    role: 'admin' | 'developer' | 'viewer';
}

/**
 * Invitation response
 */
export interface IInvitationResponse {
    id: string;
    email: string;
    role: string;
    status: 'pending' | 'accepted' | 'expired';
    invitedBy: string;
    invitedByName?: string; // For UI display
    expiresAt: string;
    createdAt: string;
    acceptedAt?: string;
}

/**
 * User list response
 */
export interface IUserListResponse {
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    lastLoginAt?: string;
    createdAt: string;
}

/**
 * Invitation validation response
 */
export interface IInvitationValidationResponse {
    valid: boolean;
    organizationName?: string;
    role?: string;
    inviterName?: string;
    userExists?: boolean; // Indicates if user should signup or login
}

// ============================================================================
// TYPE EXPORTS FOR CONVENIENCE
// ============================================================================

export type UserRole = 'admin' | 'developer' | 'viewer';
export type UserStatus = 'active' | 'invited' | 'suspended';
export type InvitationStatus = 'pending' | 'accepted' | 'expired';
export type OrganizationPlan = 'free' | 'team' | 'enterprise';
export type ExecutionStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR' | 'UNSTABLE' | 'ANALYZING';
// AutomationFramework is re-exported from the schema definition above

// ============================================================================
// SCHEDULE INTERFACES (Task 8.2)
// ============================================================================

/**
 * Schedule entity
 * Represents a recurring CRON-based test execution schedule.
 */
export interface ISchedule {
    _id: ObjectId;
    organizationId: string;
    projectId?: string;
    name: string;
    cronExpression: string;
    environment: 'development' | 'staging' | 'production';
    isActive: boolean;
    createdAt: Date;
    /** Execution payload fields mirrored from the run-settings at creation time. */
    image: string;
    folder: string;
    baseUrl: string;
}

/**
 * API payload for creating a schedule (POST /api/schedules).
 */
export interface ICreateScheduleRequest {
    name: string;
    cronExpression: string;
    environment: 'development' | 'staging' | 'production';
    projectId?: string;
    image: string;
    folder: string;
    baseUrl: string;
}

// ============================================================================
// QUALITY HUB INTERFACES (Sprint 9)
// ============================================================================

/** Distinguishes manual test cases from automated ones within a hybrid cycle. */
export type TestType = 'MANUAL' | 'AUTOMATED';

/** High-level lifecycle status of a test cycle run. */
export type CycleStatus = 'PENDING' | 'RUNNING' | 'COMPLETED';

/** Fine-grained execution status for an individual test or step. */
export type TestStatus = 'PASSED' | 'FAILED' | 'SKIPPED' | 'PENDING' | 'RUNNING' | 'ERROR';

/**
 * A single step within a manual test case.
 * Stored as embedded sub-documents inside ITestCase.steps.
 */
export interface ITestStep {
    id: string;
    action: string;
    expectedResult: string;
    status: TestStatus;
    comment?: string;
    attachmentUrl?: string;
}

/**
 * A single entry inside a hybrid test cycle.
 * Can reference either a manual test case or a linked automated execution.
 */
export interface ICycleItem {
    id: string;
    testCaseId: string;
    type: TestType;
    title: string;
    status: TestStatus;
    /** Present when type === 'AUTOMATED': links to an IExecution record. */
    executionId?: string;
    /** Present when type === 'MANUAL': step-level progress tracked here. */
    manualSteps?: ITestStep[];
}

/**
 * Manual test case entity.
 * Stored in the 'test_cases' collection with embedded steps.
 */
export interface ITestCase {
    _id?: any;
    organizationId: string;
    projectId: string;
    title: string;
    description?: string;
    /** Logical grouping — e.g. "Login", "Checkout". Used for suite-level views. */
    suite?: string;
    /** Preconditions that must be met before executing this test case. */
    preconditions?: string;
    type: TestType;
    steps?: ITestStep[];
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Hybrid test cycle entity.
 * Contains a mix of MANUAL and AUTOMATED items resolved at cycle creation time.
 * Stored in the 'test_cycles' collection with embedded items.
 */
export interface ITestCycle {
    _id?: any;
    organizationId: string;
    projectId: string;
    name: string;
    status: CycleStatus;
    items: ICycleItem[];
    summary: {
        total: number;
        passed: number;
        failed: number;
        /** Percentage (0–100) of items that are of type AUTOMATED. */
        automationRate: number;
    };
    createdAt: Date;
    createdBy: string;
}