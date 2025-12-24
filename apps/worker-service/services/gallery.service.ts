import { ApiClient } from '../helpers/apiClient';
import { APIResponse } from '@playwright/test';

export interface GalleryPayload { 
    title: string; 
    clientName: string; 
}

export interface GalleryResponse { 
    _id: string; 
    title: string; 
    secretLink: string;
    clientName: string; 
}

export class GalleryService {
    constructor(private api: ApiClient) {}

    /**
     * Creates a new gallery (Authenticated).
     */
    async create(payload: GalleryPayload): Promise<GalleryResponse> {
        return await this.api.post<GalleryResponse>('/api/galleries', payload);
    }

    /**
     * Deletes a gallery by ID (Authenticated).
     */
    async delete(id: string): Promise<void> {
        await this.api.delete(`/api/galleries/${id}`);
    }

    /**
     * Fetches a gallery via its public secret link (Unauthenticated).
     * Returns the raw APIResponse to allow status code validation in tests.
     */
    async getPublic(secretLink: string): Promise<APIResponse> {
        return await this.api.fetchRaw(`/api/galleries/public/${secretLink}`);
    }
}