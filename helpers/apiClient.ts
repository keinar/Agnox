import { type APIRequestContext, type APIResponse } from '@playwright/test';
import * as fs from 'fs';
import { Logger } from './logger';

// --- Type Definitions ---
// Defining the shape of data ensures autocomplete in tests and prevents typos.

export interface GalleryPayload {
    title: string;
    clientName: string;
}

export interface GalleryResponse {
    _id: string;
    title: string;
    clientName: string;
    secretLink: string;
    createdAt: string;
}

const AUTH_FILE_PATH = 'playwright/.auth/auth-state.json';

export class ApiClient {
    readonly request: APIRequestContext;
    private authHeader: { [key: string]: string };

    constructor(request: APIRequestContext) {
        this.request = request;
        this.authHeader = this.getAuthHeader();
    }

    // --- Generic Request Wrappers ---

    /**
     * Generic POST wrapper to handle logging and type casting.
     * @param endpoint API endpoint (e.g., 'api/galleries')
     * @param data Request payload
     * @param expectedStatus Expected HTTP status code (default 201)
     * @returns The parsed JSON response as type T
     */
    private async post<T>(endpoint: string, data: any, expectedStatus = 201): Promise<T> {
        Logger.info(`API POST Request: ${endpoint}`);
        
        const response = await this.request.post(endpoint, {
            headers: {
                ...this.authHeader,
                'Content-Type': 'application/json'
            },
            data: data
        });

        if (response.status() !== expectedStatus) {
            const errorText = await response.text();
            Logger.error(`API Failed. Status: ${response.status()} | Body: ${errorText}`);
            throw new Error(`API POST failed on ${endpoint} with status ${response.status()}`);
        }

        return await response.json() as T;
    }

    /**
     * Generic DELETE wrapper.
     */
    private async delete(endpoint: string, expectedStatus = 200): Promise<void> {
        Logger.info(`API DELETE Request: ${endpoint}`);
        
        const response = await this.request.delete(endpoint, {
            headers: this.authHeader
        });

        if (response.status() !== expectedStatus) {
            const errorText = await response.text();
            Logger.error(`API Failed. Status: ${response.status()} | Body: ${errorText}`);
            throw new Error(`API DELETE failed on ${endpoint}`);
        }
    }

    // --- Business Methods ---

    /**
     * Creates a new gallery.
     * Returns a strictly typed GalleryResponse object.
     */
    async createGallery(payload: GalleryPayload): Promise<GalleryResponse> {
        return await this.post<GalleryResponse>('/api/galleries', payload);
    }

    /**
     * Deletes a gallery by ID.
     */
    async deleteGallery(id: string): Promise<void> {
        await this.delete(`/api/galleries/${id}`);
    }

    /**
     * Retrives a public gallery (Unauthenticated endpoint).
     * We return the raw APIResponse here as we might want to test headers/status directly.
     */
    async getGalleryPublic(secretLink: string): Promise<APIResponse> {
        return this.request.get(`/api/galleries/public/${secretLink}`);
    }

    // --- Auth Logic ---

    private getAuthHeader(): { [key: string]: string } {
        try {
            if (!fs.existsSync(AUTH_FILE_PATH)) return {};
            
            const authFileContent = fs.readFileSync(AUTH_FILE_PATH, 'utf-8');
            const authData = JSON.parse(authFileContent);
            
            // Navigate the complex Playwright storageState structure
            const localStorage = authData.origins[0]?.localStorage;
            if (!localStorage) return {};

            const userItem = localStorage.find((item: any) => item.name === 'user');
            if (!userItem) return {};

            const userInfo = JSON.parse(userItem.value);
            
            if (userInfo.token) {
                return { 'Authorization': `Bearer ${userInfo.token}` };
            }
            return {};
            
        } catch (error) {
            Logger.error(`Failed to parse auth file: ${error}`);
            return {};
        }
    }
    
    /**
     * Static helper to read auth header for use in global teardowns or hooks
     * where the ApiClient instance might not be available.
     */
    public static readAuthHeaderFromDisk(): { [key: string]: string } {
         return new ApiClient({} as any).getAuthHeader(); 
    }
}