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
}