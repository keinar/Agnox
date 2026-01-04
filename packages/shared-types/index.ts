import { z } from 'zod';

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
    // The execution command (e.g., 'npx playwright test')
    command: z.string().min(1),
    tests: z.array(z.string().min(1)).optional(),
    config: ExecutionConfigSchema,
    executionId: z.string().uuid().optional(),
});

export type TestExecutionRequest = z.infer<typeof TestExecutionRequestSchema>;