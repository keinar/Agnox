import { Octokit } from '@octokit/rest';
import { ICiProvider, ICiContext, ITestMetrics } from './CiProvider.js';

export class GithubProvider implements ICiProvider {
    private octokit: Octokit;

    constructor(token: string) {
        this.octokit = new Octokit({ auth: token });
    }

    async postPrComment(
        context: ICiContext,
        analysisSummary: string,
        reportUrl: string,
        metrics: ITestMetrics
    ): Promise<void> {
        if (!context.repository || !context.prNumber) {
            console.warn('[GithubProvider] Missing repository or PR number in CI Context. Cannot post comment.');
            return;
        }

        const [owner, repo] = context.repository.split('/');

        if (!owner || !repo) {
            console.warn(`[GithubProvider] Invalid repository format: ${context.repository}. Expected "owner/repo".`);
            return;
        }

        const passCount = metrics.passed;
        const totalCount = metrics.total;

        const body = `## 🤖 AAC AI Analysis Report\n\n**Test Cycle Results**: ${passCount}/${totalCount} Passed\n\n### AI Summary\n${analysisSummary}\n\n[View Full Report in AAC](${reportUrl})`;

        try {
            await this.octokit.rest.issues.createComment({
                owner,
                repo,
                issue_number: context.prNumber,
                body,
            });
            console.log(`[GithubProvider] Successfully posted AI report to ${context.repository}#${context.prNumber}`);
        } catch (error: any) {
            console.error(`[GithubProvider] Failed to post PR comment to ${context.repository}#${context.prNumber}:`, error?.message);
        }
    }
}
