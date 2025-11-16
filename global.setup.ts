import { request, FullConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const authFile = 'playwright/.auth/auth-state.json';

async function globalSetup(config: FullConfig) {
  const apiContext = await request.newContext();
  const username = process.env.ADMIN_USER!;
  const password = process.env.ADMIN_PASS!;
  const baseURL = process.env.BASE_URL!;

  if (!username || !password || !baseURL) {
    throw new Error("Missing ADMIN_USER, ADMIN_PASS, or BASE_URL in .env file");
  }

  const loginURL = new URL('api/users/login', baseURL).toString();
  console.log(`[GlobalSetup] Attempting login to: ${loginURL}`);

  const response = await apiContext.post(loginURL, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      email: username,
      password: password,
    },
  });

  if (!response.ok()) {
    console.error(`API Login failed with status ${response.status()}`);
    console.error(`Response body: ${await response.text()}`);
    throw new Error("Global setup failed: Could not authenticate.");
  }

  const responseBody = await response.json();

  if (!responseBody.token) {
    throw new Error("Global setup failed: Token was not found in login response body.");
  }

  const authState = {
    cookies: [],
    origins: [
      {
        origin: baseURL,
        localStorage: [
          {
            name: 'user',
            value: JSON.stringify(responseBody)
          }
        ]
      }
    ]
  };

  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  fs.writeFileSync(authFile, JSON.stringify(authState));

  await apiContext.dispose();
  console.log(`[GlobalSetup] Complete. Auth state saved to ${authFile} in Playwright format.`);
}

export default globalSetup;