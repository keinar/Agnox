import { BasePage } from './basePage';
import { type Page, type Locator } from '@playwright/test';

export class DashboardPage extends BasePage {
    
    readonly galleryTitleInput: Locator;
    readonly clientNameInput: Locator;
    readonly createGalleryButton: Locator;

    constructor(page: Page) {
        super(page);

        // Define locators
        this.galleryTitleInput = page.locator('[id="galleryTitle"]');
        this.clientNameInput = page.locator('[id="clientName"]');
        this.createGalleryButton = page.locator('[id="createGalleryButton"]');
    }

    async createGallery(title: string, clientName: string) {
        await this.galleryTitleInput.fill(title);
        await this.clientNameInput.fill(clientName);
        await this.createGalleryButton.click();
    }

    async goto() {
        await this.navigateTo('https://photo-gallery.keinar.com/dashboard');
        await this.page.waitForLoadState('networkidle');
    }
}