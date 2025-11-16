import { type APIRequestContext, type APIResponse } from '@playwright/test';
import * as fs from 'fs';

/**
 * @file apiClient.ts
 * @description Wrapper for the 'photographer-gallery' API.
 */
export class ApiClient {
    readonly request: APIRequestContext;
    private authHeader: { [key: string]: string };
    private postHeaders: { [key: string]: string };

    constructor(request: APIRequestContext) {
        this.request = request;
        this.authHeader = this.getAuthHeader();
        this.postHeaders = {
            ...this.authHeader,
            'Content-Type': 'application/json'
        };
    }

    private getAuthHeader(): { [key: string]: string } {
        try {
            const authFile = 'playwright/.auth/auth-state.json';
            const authData = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
            const token = authData.token;

            if (!token) throw new Error("Token not found in auth file.");

            return {
                'Authorization': `Bearer ${token}`
            };
        } catch (error) {
            console.warn(`Could not load auth token: ${error.message}. API requests will be unauthenticated.`);
            return {};
        }
    }

    // --- CRUD Operations ---

    async createGallery(payload: { title: string; clientName: string }): Promise<APIResponse> {
        return this.request.post(`/api/galleries`, {
            headers: this.postHeaders,
            data: payload
        });
    }

    async getGalleryPublic(secretLink: string): Promise<APIResponse> {
        return this.request.get(`/api/galleries/public/${secretLink}`);
    }

    async deleteGallery(id: string): Promise<APIResponse> {
        return this.request.delete(`/api/galleries/${id}`, {
            headers: this.authHeader
        });
    }
}
