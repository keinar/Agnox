import crypto from 'crypto';
import type { StabilityScore } from '../../../../packages/shared-types/index.js';
import { Db, ObjectId } from 'mongodb';

export class SmartAnalyticsService {
    /**
     * Generate a unique MD5 hash fingerprint for an error.
     * Combines the error message and stack trace if available.
     * Returns null if no error is provided.
     */
    static generateErrorHash(errorMessage?: string | null, stackTrace?: string | null): string | null {
        if (!errorMessage && !stackTrace) {
            return null;
        }

        const input = `${errorMessage || ''}::${stackTrace || ''}`;
        return crypto.createHash('md5').update(input).digest('hex');
    }

    /**
     * Calculate a Stability Score (A-F) based on pass rate and retry rate.
     */
    static calculateStabilityScore(passRate: number, retryRate: number): StabilityScore {
        if (passRate < 0 || passRate > 1 || retryRate < 0) {
            return 'UNGRADED';
        }

        // Base Grade
        let score: StabilityScore = 'UNGRADED';
        if (passRate >= 0.95) score = 'A';
        else if (passRate >= 0.80) score = 'B';
        else if (passRate >= 0.65) score = 'C';
        else if (passRate >= 0.50) score = 'D';
        else score = 'F';

        // Penalty for high retry rate
        if (retryRate >= 0.20) {
            if (score === 'A') score = 'B';
            else if (score === 'B') score = 'C';
            else if (score === 'C') score = 'D';
            else if (score === 'D') score = 'F';
        }

        return score;
    }

    /**
     * Returns true if the current duration is significantly slower (> 1.5x)
     * than the historical average, assuming the historical average > 1000ms.
     */
    static checkPerformanceDegradation(currentMs: number, avgMs: number): boolean {
        if (avgMs <= 1000) {
            // Avoid micro-fluctuation noise for very fast tests
            return false;
        }

        return currentMs > (avgMs * 1.5);
    }

    /**
     * Phase 5: Calculate historical metrics for test cases asynchronously to avoid blocking ingestion.
     * Evaluates pass rate, average duration, and applies Auto-Quarantine logic.
     */
    static async updateTestCaseMetrics(db: Db, testCaseIds: string[], organizationId: string): Promise<void> {
        if (!testCaseIds.length) return;

        const executionsCollection = db.collection('executions');
        const testCasesCollection = db.collection('test_cases');
        const projectSettingsCollection = db.collection('project_settings');
        const projectsCollection = db.collection('projects'); // Or wherever project run settings live if named differently

        try {
            // Aggregate metrics from the last 20 executions of these tests
            const pipeline = [
                { $match: { organizationId, status: { $in: ['PASSED', 'FAILED'] } } },
                { $sort: { startTime: -1 } },
                { $limit: 100 }, // Keep the pool reasonable if they run a lot of tests
                { $unwind: "$tests" },
                { $match: { "tests.testId": { $in: testCaseIds } } },
                { $sort: { startTime: -1 } },
                {
                    $group: {
                        _id: "$tests.testId",
                        recentResults: {
                            $push: {
                                status: "$tests.status",
                                duration: "$tests.duration",
                                timestamp: "$startTime"
                            }
                        }
                    }
                },
                {
                    $project: {
                        // Slice the most recent 20 for stable metrics
                        recentResults: { $slice: ["$recentResults", 20] }
                    }
                }
            ];

            const aggregated = await executionsCollection.aggregate(pipeline).toArray();

            for (const agg of aggregated) {
                const testId = agg._id;
                const results = agg.recentResults;
                if (!results.length) continue;

                const passCount = results.filter((r: any) => r.status === 'passed').length;
                const passRate = passCount / results.length;

                // Average Duration (excluding severe outliers manually if we wanted to, but basic average is fine for MVP)
                const totalDuration = results.reduce((sum: number, r: any) => sum + (r.duration || 0), 0);
                const averageDurationMs = Math.round(totalDuration / results.length);

                const stabilityScore = this.calculateStabilityScore(passRate, 0); // Need retry data if tracked per test, but 0 serves as a baseline for Phase 5 tasks

                // Auto-Quarantine Engine
                let isQuarantined: boolean | undefined = undefined; // Undefined means don't update the flag

                // Determine consecutive failures
                let consecutiveFailures = 0;
                for (let i = 0; i < results.length; i++) {
                    if (results[i].status !== 'passed') { // failed or timedOut
                        consecutiveFailures++;
                    } else {
                        break;
                    }
                }

                // Check project configuration for quarantine
                // We need the projectId, let's fetch the testcase first
                const testCaseDoc = await testCasesCollection.findOne({ _id: new ObjectId(testId) });

                if (testCaseDoc) {
                    const projectRunSettings = await projectSettingsCollection.findOne({ projectId: testCaseDoc.projectId, organizationId });

                    const isFeatureEnabled = projectRunSettings?.autoQuarantineEnabled === true;
                    const currentlyQuarantined = testCaseDoc.isQuarantined === true;

                    if (isFeatureEnabled) {
                        if (!currentlyQuarantined && consecutiveFailures >= 3) {
                            // Automatically Quarantine
                            isQuarantined = true;
                        } else if (currentlyQuarantined && results[0].status === 'passed') {
                            // Auto-Heal
                            isQuarantined = false;
                        }
                    }
                }

                const updatePayload: any = {
                    $set: {
                        stabilityScore,
                        averageDurationMs,
                        updatedAt: new Date()
                    }
                };

                if (isQuarantined !== undefined) {
                    updatePayload.$set.isQuarantined = isQuarantined;
                    // Reset abuse count if healing, just as a bonus cleanup step.
                    if (isQuarantined === false) {
                        updatePayload.$set.retryAbuseCount = 0;
                    }
                }

                await testCasesCollection.updateOne(
                    { _id: new ObjectId(testId), organizationId },
                    updatePayload
                );
            }
        } catch (error) {
            console.error('[SmartAnalytics] Failure aggregating test case metrics:', error);
        }
    }
}
