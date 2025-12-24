import { z } from 'zod';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

/**
 * Zod Schema for Environment Variables.
 * This ensures the test run fails immediately if configuration is missing.
 */
const envSchema = z.object({
    MONGO_URI: z.string().startsWith('mongodb'),
    BASE_URL: z.url().optional(),
    ADMIN_USER: z.email().optional(),
    ADMIN_PASS: z.string().min(1).optional(),
    GEMINI_API_KEY: z.string().optional()
});

export const config = envSchema.parse(process.env);