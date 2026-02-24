import { ICycleItem } from '../../../../packages/shared-types/index.js';

export interface ICiContext {
    source: 'github' | 'gitlab' | 'azure' | 'jenkins' | 'webhook';
    repository?: string;
    prNumber?: number;
    commitSha?: string;
}

export interface ITestMetrics {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    flaky?: number;
}

export interface ICiProvider {
    postPrComment(
        context: ICiContext,
        analysisSummary: string,
        reportUrl: string,
        metrics: ITestMetrics
    ): Promise<void>;
}
