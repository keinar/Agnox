export interface ExecutionConfig {
    environment: string;
    baseUrl: string;
    retryAttempts: number;
}

export interface IIngestCiContext {
    source: 'github' | 'gitlab' | 'azure' | 'jenkins' | 'local';
    repository?: string;
    branch?: string;
    prNumber?: number;
    commitSha?: string;
    /** URL back to the originating CI job (e.g. GitHub Actions run URL). */
    runUrl?: string;
}

export interface IIngestMeta {
    sessionId: string;
    reporterVersion: string;
    framework: string;
    totalTests: number;
    ciContext?: IIngestCiContext;
}

export interface Execution {
    _id: string;
    taskId: string;
    status: 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR' | 'UNSTABLE' | 'ANALYZING';
    startTime: string;
    endTime?: string;
    tests: string[];
    output?: string;
    error?: string;
    analysis?: string;
    config: ExecutionConfig;
    hasNativeReport?: boolean;
    hasAllureReport?: boolean;
    /** Logical run-group label (e.g. "Daily Sanity"). */
    groupName?: string;
    /** CI-level batch identifier shared by runs triggered together. */
    batchId?: string;
    /** Discriminates hosted Docker runs from external CI passive runs. */
    source?: 'agnox-hosted' | 'external-ci';
    /** Populated only when source === 'external-ci'. */
    ingestMeta?: IIngestMeta;
}

/** A single bucket returned by GET /api/executions/grouped */
export interface IExecutionGroup {
    groupName: string;
    totalCount: number;
    passCount: number;
    lastRunAt: string;
    executions: Execution[];
}

/** Paginated response from GET /api/executions/grouped */
export interface IExecutionGroupPage {
    groups: IExecutionGroup[];
    totalGroups: number;
    limit: number;
    offset: number;
}

export type ViewMode = 'flat' | 'grouped';