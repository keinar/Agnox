import { z } from 'zod';
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
