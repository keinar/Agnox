import { v4 as uuidv4 } from 'uuid';
import { ApiClient } from './apiClient';
import { Logger } from './logger';

export class TestDataManager {
    private createdGalleryIds: string[] = [];
    private apiClient: ApiClient;

    constructor(apiClient: ApiClient) {
        this.apiClient = apiClient;
    }

    /**
     * Generates a unique traceable entity name
     */
    generateUniqueName(prefix: string): string {
        return `${prefix}_${uuidv4()}`;
    }

    /**
     * Registers an ID for cleanup
     */
    registerGallery(id: string) {
        this.createdGalleryIds.push(id);
    }

    /**
     * Guaranteed cleanup of all registered resources
     */
    async cleanup() {
        Logger.info(`[Teardown] Cleaning up ${this.createdGalleryIds.length} galleries...`);
        for (const id of this.createdGalleryIds) {
            try {
                await this.apiClient.deleteGallery(id);
                Logger.info(`[Teardown] Deleted gallery: ${id}`);
            } catch (error) {
                Logger.error(`[Teardown] Failed to delete gallery ${id}: ${error}`);
            }
        }
        this.createdGalleryIds = []; // Reset list
    }
}