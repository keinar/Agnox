import { request, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { config } from './config/env';
import { ApiClient } from './helpers/apiClient';
import { AuthService } from './services/auth.service';
import { Logger } from './helpers/logger';

const authFile = '.auth/auth-state.json';

async function globalSetup(fullConfig: FullConfig) {
    Logger.clean();
    console.log('[GlobalSetup] Starting authentication flow...');

    // 1. Initialize Request Context with Base URL from Config
    const requestContext = await request.newContext({
        baseURL: config.BASE_URL
    });

    // 2. Initialize Services
    const apiClient = new ApiClient(requestContext);
    const authService = new AuthService(apiClient);

    // 3. Perform Login
    try {
        const loginData = await authService.login();
        
        if (!loginData.token) {
            throw new Error("Token missing in login response");
        }

        console.log('[GlobalSetup] Login successful.');

        // 4. Construct Playwright Storage State
        const authState = {
            cookies: [],
            origins: [
                {
                    origin: config.BASE_URL,
                    localStorage: [
                        {
                            name: 'user',
                            value: JSON.stringify(loginData)
                        }
                    ]
                }
            ]
        };

        // 5. Save to Disk
        const authDir = path.dirname(authFile);
        if (!fs.existsSync(authDir)) {
            fs.mkdirSync(authDir, { recursive: true });
        }

        fs.writeFileSync(authFile, JSON.stringify(authState));
        console.log(`[GlobalSetup] Auth state saved to ${authFile}`);

    } catch (error) {
        console.error('[GlobalSetup] Authentication Failed:', error);
        throw error;
    } finally {
        await requestContext.dispose();
    }
}

export default globalSetup;