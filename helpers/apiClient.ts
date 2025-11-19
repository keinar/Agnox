import { type APIRequestContext, type APIResponse } from '@playwright/test';
import * as fs from 'fs'; // Import File System module


const AUTH_FILE_PATH = 'playwright/.auth/auth-state.json';

/**
 * @file apiClient.ts
 * @description Wrapper for the 'photographer-gallery' API.
 * This client is now "smart" and knows how to parse the
 * complex 'auth-state.json' file created by global.setup.ts.
 */
export class ApiClient {
    readonly request: APIRequestContext;
    private authHeader: { [key: string]: string };
    private postHeaders: { [key: string]: string };

    /**
     * @param request - The Playwright APIRequestContext.
     */
    constructor(request: APIRequestContext) {
        this.request = request;
        // This function will now correctly read the complex auth file
        this.authHeader = this.getAuthHeader();
        // Combine auth and content-type for POST/PUT
        this.postHeaders = {
            ...this.authHeader,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Reads the complex Playwright 'auth-state.json' file
     * and extracts the JWT token from localStorage.
     * @returns The Authorization header object.
     */
    private getAuthHeader(): { [key: string]: string } {
        try {
            const authFile = 'playwright/.auth/auth-state.json';
            
            // --- THIS IS THE FIX ---
            // 1. Read the complex auth state file
            const authFileContent = fs.readFileSync(authFile, 'utf-8');
            const authData = JSON.parse(authFileContent);

            // 2. Navigate the complex object to find the 'user' item
            const localStorage = authData.origins[0].localStorage;
            const userItem = localStorage.find(
                (item: { name: string; }) => item.name === 'user' // Your app uses 'user'
            );

            if (!userItem) {
                throw new Error("Could not find 'user' in localStorage of auth file.");
            }

            // 3. Parse the *inner* JSON string (the value of 'user')
            const userInfo = JSON.parse(userItem.value);
            const token = userInfo.token;
            // --- END OF FIX ---
            
            if (!token) {
                throw new Error("Token not found in auth file.");
            }
            
            // Return only the Authorization header
            return {
                'Authorization': `Bearer ${token}`
            };
        } catch (error) {
            console.warn(`[ApiClient] Could not load auth token: ${error.message}. API requests will be unauthenticated.`);
            // Return an empty object if auth fails
            return {};
        }
    }

    // --- CRUD Operations (no changes needed here) ---

    async createGallery(payload: { title: string; clientName: string }): Promise<APIResponse> {
        return this.request.post('api/galleries', {
            headers: this.postHeaders, 
            data: payload
        });
    }

    async getGalleryPublic(secretLink: string): Promise<APIResponse> {
        return this.request.get(`/api/galleries/public/${secretLink}`);
    }
    
    async deleteGallery(id: string): Promise<APIResponse> {
        return this.request.delete(`api/galleries/${id}`, {
            headers: this.authHeader
        });
    }

    /**
     * Public static method to retrieve the Authorization header (JWT)
     * by reading the auth state file directly from disk.
     * Useful for unauthenticated hooks (like test.afterAll) that require API access.
     * @returns The Authorization header object, or empty object if token is missing.
     */
    public static readAuthHeaderFromDisk(): { [key: string]: string } {
        try {
            // 1. Read the complex auth state file
            const authFileContent = fs.readFileSync(AUTH_FILE_PATH, 'utf-8');
            const authData = JSON.parse(authFileContent);

            // 2. Navigate the complex object to find the 'user' item (which holds the JWT)
            const localStorage = authData.origins[0].localStorage;
            const userItem = localStorage.find(
                (item: { name: string; }) => item.name === 'user' 
            );

            if (!userItem) {
                throw new Error("Could not find 'user' in localStorage of auth file.");
            }

            // 3. Parse the *inner* JSON string (the value of 'user')
            const userInfo = JSON.parse(userItem.value);
            const token = userInfo.token;
            
            if (!token) {
                throw new Error("Token not found in auth file.");
            }
            
            // Return only the Authorization header
            return {
                'Authorization': `Bearer ${token}`
            };
        } catch (error) {
            console.warn(`[ApiClient] Could not load auth token for teardown: ${error.message}.`);
            // Return an empty object if auth fails
            return {};
        }
    }
}