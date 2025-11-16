import { request, FullConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
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
  const token = responseBody.token;

  if (!token) {
    throw new Error("Global setup failed: Token was not found in login response body.");
  }

  // 2. Manually write the token to the auth file
  // We create our own simple JSON structure
  fs.writeFileSync(authFile, JSON.stringify({ token: token }));

  await apiContext.dispose();
  console.log(`[GlobalSetup] Complete. Auth state saved to ${authFile}`);
}

export default globalSetup;