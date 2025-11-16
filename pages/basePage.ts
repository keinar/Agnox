import { Page } from "@playwright/test";

/**
 * BasePage class to be extended by all page objects
 */
export class BasePage {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    async navigateTo(path: string) {
        await this.page.goto(path);
    }
}