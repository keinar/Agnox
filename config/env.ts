import { z } from 'zod';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const envSchema = z.object({
    BASE_URL: z.url(),
    MONGO_URI: z.string().startsWith('mongodb'),
    ADMIN_USER: z.email(),
    ADMIN_PASS: z.string().min(1),
    GEMINI_API_KEY: z.string().optional()
});

export const config = envSchema.parse(process.env);