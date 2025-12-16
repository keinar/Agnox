import { ApiClient } from '../helpers/apiClient';

export interface GalleryPayload { title: string; clientName: string; }
export interface GalleryResponse { _id: string; title: string; secretLink: string; }

export class GalleryService {
    constructor(private api: ApiClient) {}

    async create(payload: GalleryPayload): Promise<GalleryResponse> {
        return await this.api.post<GalleryResponse>('/api/galleries', payload);
    }

    async delete(id: string): Promise<void> {
        await this.api.delete(`/api/galleries/${id}`);
    }
}