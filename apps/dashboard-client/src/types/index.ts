export interface ExecutionConfig {
    environment: string;
    baseUrl: string;
    retryAttempts: number;
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