import { ICycleItem } from '../../../../packages/shared-types/index.js';

export interface ICiContext {
    source: 'github' | 'gitlab' | 'azure' | 'jenkins' | 'webhook';
    repository?: string;
    prNumber?: number;
    commitSha?: string;
}

export interface ICiProvider {
    postPrComment(
        context: ICiContext,
        analysisSummary: string,
        reportUrl: string,
        cycleItems: ICycleItem[]
    ): Promise<void>;
}
