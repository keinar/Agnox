import { test as base, expect } from '@playwright/test';
import { ExecutionDrawerPage } from '../pages/ExecutionDrawerPage';
import { SettingsIntegrationsPage } from '../pages/SettingsIntegrationsPage';
import { MembersPage } from '../pages/MembersPage';

export const test = base.extend<{
    drawerPage: ExecutionDrawerPage;
    settingsPage: SettingsIntegrationsPage;
    membersPage: MembersPage;
}>({
    drawerPage: async ({ page }, use) => await use(new ExecutionDrawerPage(page)),
    settingsPage: async ({ page }, use) => await use(new SettingsIntegrationsPage(page)),
    membersPage: async ({ page }, use) => await use(new MembersPage(page)),
});

export { expect };
