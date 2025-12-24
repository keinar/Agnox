import { z } from 'zod';

export const ExecutionConfigSchema = z.object({
    project: z.string().optional(),
    environment: z.enum(['development', 'staging', 'production']),
    baseUrl: z.url().optional(),
    retryAttempts: z.number().min(0).max(5).default(2)
});

export const TestExecutionRequestSchema = z.object({
    taskId: z.string().min(1),
    tests: z.array(z.string().min(1)),
    config: ExecutionConfigSchema,
    executionId: z.uuid().optional(),
});

export type TestExecutionRequest = z.infer<typeof TestExecutionRequestSchema>;