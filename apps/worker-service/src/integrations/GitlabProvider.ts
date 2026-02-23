import { Gitlab } from '@gitbeaker/rest';
import { ICiProvider, ICiContext } from './CiProvider.js';
import { ICycleItem } from '../../../../packages/shared-types/index.js';

export class GitlabProvider implements ICiProvider {
    private client: any;

    constructor(token: string) {
        // Initialize Gitbeaker client
        // Gitbeaker defaults to gitlab.com but allows overriding host if necessary
        this.client = new Gitlab({ token });
    }

    async postPrComment(
        context: ICiContext,
        analysisSummary: string,
        reportUrl: string,
        cycleItems: ICycleItem[]
    ): Promise<void> {
        if (!context.repository || !context.prNumber) {
            console.warn('[GitlabProvider] Missing repository (projectId) or PR number (Merge Request IID) in CI Context. Cannot post comment.');
            return;
        }

        const projectId = context.repository;
        const mergeRequestIid = context.prNumber;

        const passCount = cycleItems.filter(i => i.status === 'PASSED').length;
        const totalCount = cycleItems.length;

        const body = `## 🤖 AAC AI Analysis Report\n\n**Test Cycle Results**: ${passCount}/${totalCount} Passed\n\n### AI Summary\n${analysisSummary}\n\n[View Full Report in AAC](${reportUrl})`;

        try {
            await this.client.MergeRequestNotes.create(
                projectId as any,
                mergeRequestIid as any,
                body
            );
            console.log(`[GitlabProvider] Successfully posted AI report to Project ${projectId} MR !${mergeRequestIid}`);
        } catch (error: any) {
            console.error(`[GitlabProvider] Failed to post MR comment to Project ${projectId} MR !${mergeRequestIid}:`, error?.message);
        }
    }
}
