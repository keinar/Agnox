export interface ExecutionConfig {
    environment: string;
    baseUrl: string;
    retryAttempts: number;
}
  
export interface Execution {
    _id: string;
    taskId: string;
    status: 'RUNNING' | 'PASSED' | 'FAILED';
    startTime: string;
    endTime?: string;
    tests: string[];
    output?: string;
    error?: string;
    config: ExecutionConfig;
}