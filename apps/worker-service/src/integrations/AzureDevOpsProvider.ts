import * as azdev from 'azure-devops-node-api';
import { GitPullRequestCommentThread } from 'azure-devops-node-api/interfaces/GitInterfaces.js';
import { ICiProvider, ICiContext } from './CiProvider.js';
import { ICycleItem } from '../../../../packages/shared-types/index.js';

export class AzureDevOpsProvider implements ICiProvider {
    private connection: azdev.WebApi;

    constructor(token: string) {
        // Azure DevOps requires the collection URL. For most cloud setups it is https://dev.azure.com/organization
        // We will default to a generic URL, but typically the user should provide the org URL.
        // Assuming the repository format is "organization/project/repository"
        // Since we don't have the org URL directly, we instantiate with a generic base if not provided.
        // For Azure DevOps, PAT authentication creates a personal access token handler
        const authHandler = azdev.getPersonalAccessTokenHandler(token);

        // As a fallback, try to get the server URL from env or use a dummy that the client might fix
        const orgUrl = process.env.AZURE_DEVOPS_ORG_URL || 'https://dev.azure.com/dummy';
        this.connection = new azdev.WebApi(orgUrl, authHandler);
    }

    async postPrComment(
        context: ICiContext,
        analysisSummary: string,
        reportUrl: string,
        cycleItems: ICycleItem[]
    ): Promise<void> {
        if (!context.repository || !context.prNumber) {
            console.warn('[AzureDevOpsProvider] Missing repository or PR number in CI Context. Cannot post comment.');
            return;
        }

        const pullRequestId = context.prNumber;

        // Normally context.repository for Azure might contain the repository ID or name
        const repositoryId = context.repository;

        const passCount = cycleItems.filter(i => i.status === 'PASSED').length;
        const totalCount = cycleItems.length;

        const content = `## 🤖 AAC AI Analysis Report\n\n**Test Cycle Results**: ${passCount}/${totalCount} Passed\n\n### AI Summary\n${analysisSummary}\n\n[View Full Report in AAC](${reportUrl})`;

        try {
            const gitApi = await this.connection.getGitApi();

            const thread: GitPullRequestCommentThread = {
                comments: [
                    {
                        content: content,
                        commentType: 1 // Text
                    }
                ],
                status: 1 // Active
            };

            await (gitApi.createThread as any)(
                thread,
                repositoryId,
                pullRequestId
            );
            console.log(`[AzureDevOpsProvider] Successfully posted AI report to Azure DevOps Repos PR #${pullRequestId}`);
        } catch (error: any) {
            console.error(`[AzureDevOpsProvider] Failed to post PR comment to Azure DevOps Repos PR #${pullRequestId}:`, error?.message);
        }
    }
}
