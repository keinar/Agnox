import { Logger } from './logger';

export class PollingHelper {
    /**
     * @param description
     * @param pollFn
     * @param conditionFn
     */
    static async pollUntil<T>(
        description: string,
        pollFn: () => Promise<T>,
        conditionFn: (result: T) => boolean,
        timeoutMs: number = 10000,
        intervalMs: number = 500
    ): Promise<T> {
        const startTime = Date.now();
        Logger.info(`[Polling] Starting: ${description}`);

        while (Date.now() - startTime < timeoutMs) {
            const result = await pollFn();
            if (conditionFn(result)) {
                Logger.info(`[Polling] Success: ${description}`);
                return result;
            }
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }

        throw new Error(`[Polling] Timeout waiting for: ${description}`);
    }
}