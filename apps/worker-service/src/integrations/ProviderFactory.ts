import { ICiProvider } from './CiProvider.js';
import { GithubProvider } from './GithubProvider.js';
import { GitlabProvider } from './GitlabProvider.js';
import { AzureDevOpsProvider } from './AzureDevOpsProvider.js';

export class ProviderFactory {
    static getProvider(source: string, token: string): ICiProvider | null {
        switch (source) {
            case 'github':
                return new GithubProvider(token);
            case 'gitlab':
                return new GitlabProvider(token);
            case 'azure':
                return new AzureDevOpsProvider(token);
            default:
                console.warn(`[ProviderFactory] Unsupported CI source: ${source}`);
                return null;
        }
    }
}
