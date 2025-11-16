import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './basePage';


export class ProfilePage extends BasePage {
    readonly usernameInput: Locator;
    readonly emailInput: Locator;
    readonly passwordInput: Locator;
    readonly confirmPasswordInput: Locator;
    readonly updateButton: Locator;
    readonly backToDashboardBtn: Locator;


    constructor(page: Page) {
        super(page); 

        // Define locators
        this.usernameInput = page.locator('[id="name"]');
        this.emailInput = page.locator('[id="email"]');
        this.passwordInput = page.locator('[id="password"]');
        this.confirmPasswordInput = page.locator('[id="confirmPassword"]');
        this.updateButton = page.locator('button:has-text("Update Profile")');
        this.backToDashboardBtn = page.locator('a:has-text("Back to Dashboard")');
    }

    async updateProfile(username: string, email: string, password: string) {
        await this.usernameInput.fill(username);
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await this.confirmPasswordInput.fill(password);
        await this.updateButton.click();
    }

    async backToDashboard() {
        await this.backToDashboardBtn.click();
    }

    async goto() {
        await this.navigateTo('https://photo-gallery.keinar.com/profile');
        await this.page.waitForLoadState('networkidle');
    }
}