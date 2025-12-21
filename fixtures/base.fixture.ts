import { test as base } from '@playwright/test';
import { ApiClient } from '../helpers/apiClient';
import { MongoHelper } from '../helpers/mongoHelper';
import { AuthService } from '../services/auth.service';
import { GalleryService } from '../services/gallery.service';
import { GalleryRepository } from '../repositories/gallery.repository';
import { DashboardPage } from '../pages/dashboardPage';
import { LoginPage } from '../pages/loginPage';
import { ProfilePage } from '../pages/profilePage';
import { AiHelper } from '../helpers/aiHelper';

type WorkerFixtures = {
    mongoWorker: MongoHelper;
};

type MyFixtures = {
    // Infrastructure
    apiClient: ApiClient;
    mongoHelper: MongoHelper;
    aiHelper: AiHelper;
    
    // Services (API/Logic)
    authService: AuthService;
    galleryService: GalleryService;
    
    // Repositories (DB)
    galleryRepo: GalleryRepository;
    
    // Page Objects (UI)
    dashboardPage: DashboardPage;
    loginPage: LoginPage;
    profilePage: ProfilePage;
};

export const test = base.extend<MyFixtures, WorkerFixtures>({
    // --- Infrastructure ---
    apiClient: async ({ request }, use) => {
        await use(new ApiClient(request));
    },

    mongoWorker: [async ({}, use) => {
        const mongo = new MongoHelper();
        await mongo.connect();
        await use(mongo);
        await mongo.disconnect();
    }, { scope: 'worker' }],

    mongoHelper: async ({ mongoWorker }, use) => {
        await use(mongoWorker);
    },

    aiHelper: async ({}, use) => {
        await use(new AiHelper());
    },

    // --- Services ---
    authService: async ({ apiClient }, use) => {
        await use(new AuthService(apiClient));
    },
    galleryService: async ({ apiClient }, use) => {
        await use(new GalleryService(apiClient));
    },

    // --- Repositories ---
    galleryRepo: async ({ mongoHelper }, use) => {
        await use(new GalleryRepository(mongoHelper));
    },

    // --- Page Objects ---
    dashboardPage: async ({ page }, use) => {
        await use(new DashboardPage(page));
    },
    loginPage: async ({ page }, use) => {
        await use(new LoginPage(page));
    },
    profilePage: async ({ page }, use) => {
        await use(new ProfilePage(page));
    }
});

export { expect } from '@playwright/test';