import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import { ApiClient } from '../../helpers/apiClient';
import { GalleryService } from '../../services/gallery.service';
import { GalleryRepository } from '../../repositories/gallery.repository';
import { MongoHelper } from '../../helpers/mongoHelper';
import { DashboardPage } from '../../pages/dashboardPage';
import { PollingHelper } from '../../helpers/pollingHelper';

test.describe('Hybrid E2E - Enterprise Architecture', () => {
    let galleryService: GalleryService;
    let galleryRepo: GalleryRepository;
    let dashboardPage: DashboardPage;
    let mongoHelper: MongoHelper;
    
    let createdGalleryId: string;

    test.beforeAll(async () => {
        mongoHelper = new MongoHelper();
        await mongoHelper.connect();
    });

    test.afterAll(async () => {
        await mongoHelper.disconnect();
    });

    test.beforeEach(async ({ page, request }) => {
        // Init Infrastructure
        const apiClient = new ApiClient(request);
        
        // Init Layers
        galleryService = new GalleryService(apiClient);
        galleryRepo = new GalleryRepository(mongoHelper);
        dashboardPage = new DashboardPage(page);
    });

    test.afterEach(async () => {
        if (createdGalleryId) {
            console.log(`[Teardown] Cleaning up gallery: ${createdGalleryId}`);
            await galleryService.delete(createdGalleryId);
        }
    });

    test('Full Sync Flow: Service -> UI -> Repository Validation', async () => {
        // 1. Arrange: Data Isolation using UUID
        const uniqueTitle = `Senior-Test-${uuidv4()}`;
        const payload = { title: uniqueTitle, clientName: 'Enterprise Client' };

        console.log('[Step 1] Creating via Service Layer (API)...');
        const gallery = await galleryService.create(payload);
        createdGalleryId = gallery._id;

        // 2. Act: UI Verification
        console.log('[Step 2] Verifying via Page Object (UI)...');
        await dashboardPage.goto();
        await dashboardPage.validateGalleryVisible(uniqueTitle, 'Enterprise Client');

        // 3. Assert: DB Integrity using Polling (Repository Layer)
        console.log('[Step 3] Validating Data Integrity (DB)...');
        
        const dbRecord = await PollingHelper.pollUntil(
            "Gallery record in DB",
            async () => await galleryRepo.findById(gallery._id),
            (record) => record !== null && record.title === uniqueTitle
        );

        expect(dbRecord).toBeDefined();
        expect(dbRecord?.clientName).toBe('Enterprise Client');
    });
});