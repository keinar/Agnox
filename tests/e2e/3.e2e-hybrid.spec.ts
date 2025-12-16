import { test, expect } from '../../fixtures/base.fixture';
import { v4 as uuidv4 } from 'uuid';
import { DashboardPage } from '../../pages/dashboardPage';
import { PollingHelper } from '../../helpers/pollingHelper';

test.describe('Hybrid E2E - Enterprise Architecture', () => {
    
    let createdGalleryId: string;

    test('Full Sync Flow', async ({ galleryService, galleryRepo, page }) => {
        const dashboardPage = new DashboardPage(page);
        
        const uniqueTitle = `Senior-Test-${uuidv4()}`;
        const gallery = await galleryService.create({ title: uniqueTitle, clientName: 'Fixture Client' });
        createdGalleryId = gallery._id;

        await dashboardPage.goto();
        await dashboardPage.validateGalleryVisible(uniqueTitle, 'Fixture Client');

        const dbRecord = await PollingHelper.pollUntil(
            "Gallery record in DB",
            async () => await galleryRepo.findById(gallery._id),
            (record) => record !== null && record.title === uniqueTitle
        );
        expect(dbRecord).toBeDefined();
        
        await galleryService.delete(createdGalleryId);
    });
});