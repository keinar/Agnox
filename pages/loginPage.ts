import { BasePage } from './basePage';
import { type Page, type Locator } from '@playwright/test';

export class LoginPage extends BasePage {
    readonly emailInput: Locator;
    readonly passwordInput: Locator;
    readonly loginButton: Locator;

    constructor(page: Page) {
        super(page);

        // Define locators
        this.emailInput = page.locator('[type="email"]');
        this.passwordInput = page.locator('[type="password"]');
        this.loginButton = page.locator('button:has-text("Sign In")');
    }

    async login(email: string, password: string) {
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await this.loginButton.click();
    }

    async goto() {
        await this.navigateTo('https://photo-gallery.keinar.com/login');
        await this.page.waitForLoadState('networkidle');
    }
}