import { GalleryPayload } from './apiClient';

export class GalleryFactory {
    static createDefault(): GalleryPayload {
        const uniqueId = Date.now();
        return {
            title: `Auto-Gallery-${uniqueId}`,
            clientName: `Client-${uniqueId}`
        };
    }

    static createWithCustomName(name: string): GalleryPayload {
        return {
            title: name,
            clientName: 'VIP Client'
        };
    }
}