import { BasePage } from './basePage';
import { type Page, type Locator } from '@playwright/test';

export class DashboardPage extends BasePage {
    
    // Private Locators - Encapsulation ensures tests can't bypass our logic
    private readonly galleryTitleInput: Locator;
    private readonly clientNameInput: Locator;
    private readonly createGalleryButton: Locator;
    private readonly sidebar: Locator;
    private readonly logoutButton: Locator;

    constructor(page: Page) {
        super(page);

        // Initialize locators using specific IDs or Roles
        this.galleryTitleInput = page.locator('#galleryTitle');
        this.clientNameInput = page.locator('#clientName');
        this.createGalleryButton = page.locator('#createGalleryButton');
        
        // Complex locators are defined once here
        this.sidebar = page.locator('aside div').first();
        this.logoutButton = page.getByRole('button', { name: 'Logout' });
    }

    /**
     * Business Action: Creates a new gallery.
     * Logs and steps are handled automatically by BasePage.
     */
    async createGallery(title: string, clientName: string) {
        await this.fillElement(this.galleryTitleInput, title, "Gallery Title Input");
        await this.fillElement(this.clientNameInput, clientName, "Client Name Input");
        await this.clickElement(this.createGalleryButton, "Create Gallery Button");
    }

    async goto() {
        await this.navigateTo('/dashboard');
    }

    async logout() {
        await this.clickElement(this.logoutButton, "Logout Button");
    }

    async verifySidebarVisible() {
        await this.validateElementVisible(this.sidebar, "Dashboard Sidebar");
    }
}