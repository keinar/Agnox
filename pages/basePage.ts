import { Locator, Page, test, expect } from "@playwright/test";
import { Logger } from "../helpers/logger";

export abstract class BasePage {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    private async step<T>(description: string, action: () => Promise<T>): Promise<T> {
        Logger.info(description);

        return await test.step(description, async () => {
            try {
                return await action();
            } catch (error) {
                Logger.error(`Failed step: ${description}`);
                throw error;
            }
        });
    }

    protected async navigateTo(path: string) {
        await this.step(`Maps to URL: '${path}'`, async () => {
            await this.page.goto(path, { waitUntil: 'domcontentloaded' });
        });
    }

    protected async clickElement(locator: Locator) {
        await this.step(`Click '${locator}'`, async () => {
            await locator.waitFor({ state: 'visible' });
            await locator.click();
        });
    }

    protected async fillElement(locator: Locator, value: string) {
        await this.step(`Fill '${value}' into '${locator}'`, async () => {
            await locator.waitFor({ state: 'visible' });
            await locator.fill(value);
        });
    }

    protected async getElementText(locator: Locator): Promise<string> {
        return await this.step(`Get text from '${locator}'`, async () => {
            const text = await locator.textContent();
            return text ?? '';
        });
    }

    protected async validateElementContainsText(locator: Locator, expectedText: string) {
        await this.step(`Assert '${locator}' contains text: "${expectedText}"`, async () => {
            await expect(locator).toContainText(expectedText);
        });
    }

    protected async validateElementVisible(locator: Locator) {
        await this.step(`Assert '${locator}' is visible`, async () => {
            await expect(locator).toBeVisible();
        });
    }
}