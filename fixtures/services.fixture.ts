import { test as base } from '@playwright/test';
import { ApiClient } from '../helpers/apiClient';
import { MongoHelper } from '../helpers/mongoHelper';
import { AuthService } from '../services/auth.service';
import { GalleryService } from '../services/gallery.service';
import { GalleryRepository } from '../repositories/gallery.repository';

type ServiceFixtures = {
    apiClient: ApiClient;
    mongoHelper: MongoHelper;
    authService: AuthService;
    galleryService: GalleryService;
    galleryRepo: GalleryRepository;
};

export const test = base.extend<ServiceFixtures>({

    apiClient: async ({ request }, use) => {
        const client = new ApiClient(request);
        await use(client);
    },

    mongoHelper: async ({}, use) => {
        const mongo = new MongoHelper();
        await mongo.connect();
        await use(mongo);
        await mongo.disconnect();
    },

    authService: async ({ apiClient }, use) => {
        await use(new AuthService(apiClient));
    },

    galleryService: async ({ apiClient }, use) => {
        await use(new GalleryService(apiClient));
    },

    galleryRepo: async ({ mongoHelper }, use) => {
        await use(new GalleryRepository(mongoHelper));
    },
});

export { expect } from '@playwright/test';