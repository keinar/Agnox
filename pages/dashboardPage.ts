import { BasePage } from './basePage';
import { type Page, type Locator } from '@playwright/test';

export class DashboardPage extends BasePage {
    
    readonly galleryTitleInput: Locator;
    readonly clientNameInput: Locator;
    readonly createGalleryButton: Locator;
    readonly sidebar: Locator;

    constructor(page: Page) {
        super(page);

        // Define locators
        this.galleryTitleInput = page.locator('[id="galleryTitle"]');
        this.clientNameInput = page.locator('[id="clientName"]');
        this.createGalleryButton = page.locator('[id="createGalleryButton"]');
        this.sidebar = page.locator('aside div').nth(0);
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

    async logout() {
        const logoutButton = this.page.getByRole('button', { name: 'Logout' });
        await logoutButton.click();
        await this.page.waitForLoadState('networkidle');
    }
}