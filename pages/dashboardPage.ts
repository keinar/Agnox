import { BasePage } from './basePage';
import { type Page, type Locator } from '@playwright/test';

export class DashboardPage extends BasePage {
    
    // Private Locators - Strictly Encapsulated
    private readonly galleryTitleInput: Locator;
    private readonly clientNameInput: Locator;
    private readonly createGalleryButton: Locator;
    private readonly sidebar: Locator;
    private readonly logoutButton: Locator;

    constructor(page: Page) {
        super(page);

        // Locators Definition
        this.galleryTitleInput = page.locator('#galleryTitle');
        this.clientNameInput = page.locator('#clientName');
        this.createGalleryButton = page.locator('#createGalleryButton');
        this.sidebar = page.locator('aside div').first();
        this.logoutButton = page.getByRole('button', { name: 'Logout' });
    }

    /**
     * Creates a new gallery via the UI.
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

    /**
     * Validates that a gallery card appears on the dashboard with correct details.
     * This encapsulates the DOM structure knowledge within the Page Object.
     */
    async validateGalleryVisible(title: string, clientName: string) {
        // Scoped locator: Finds a card that specifically contains the title text
        const galleryCard = this.page.locator('div.border', { hasText: title });

        await this.validateElementVisible(galleryCard, `Gallery Card for "${title}"`);
        
        await this.validateElementContainsText(
            galleryCard, 
            clientName, 
            `Gallery Card Client Name ("${clientName}")`
        );
    }
}