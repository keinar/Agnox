/**
 * Analytics Routes
 *
 * Provides real-time KPI metrics aggregated from the executions collection.
 * All queries are strictly scoped to the caller's organizationId (tenant isolation).
 *
 * Endpoints:
 *   GET /api/analytics/kpis — Aggregate Total Runs, Success Rate, Avg. Duration
 *                             for the current calendar month.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MongoClient } from 'mongodb';
import { getDbName } from '../config/server.js';

const DB_NAME = getDbName();

/** Finished terminal statuses that contribute to success rate. */
const FINISHED_STATUSES = ['PASSED', 'FAILED', 'ERROR', 'UNSTABLE'] as const;

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface IAnalyticsKPIs {
    totalRuns: number;
    passedRuns: number;
    finishedRuns: number;
    /** Percentage 0–100, rounded to 1 decimal place. */
    successRate: number;
    /** Average duration in milliseconds across finished runs with an endTime. */
    avgDurationMs: number;
    /** ISO calendar month of the aggregation window, e.g. "2026-02". */
    period: string;
}

interface IAggregationResult {
    totalRuns: number;
    passedRuns: number;
    finishedRuns: number;
    durationSum: number;
    durationCount: number;
}

// ── Route registration ────────────────────────────────────────────────────────

export async function analyticsRoutes(
    app: FastifyInstance,
    mongoClient: MongoClient,
    apiRateLimit: (request: FastifyRequest, reply: FastifyReply) => Promise<void>,
): Promise<void> {
    const executions = mongoClient.db(DB_NAME).collection('executions');

    /**
     * GET /api/analytics/kpis
     *
     * Returns KPI metrics for the caller's organization scoped to the current
     * calendar month (UTC). Soft-deleted executions are excluded.
     *
     * Response shape:
     *   { success: true, data: IAnalyticsKPIs }
     */
    app.get('/api/analytics/kpis', async (request: FastifyRequest, reply: FastifyReply) => {
        const organizationId = request.user!.organizationId;

        // Compute the start of the current calendar month (UTC midnight on day 1).
        const now = new Date();
        const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

        try {
            const pipeline = [
                // ── Stage 1: Tenant-scoped filter ───────────────────────────
                {
                    $match: {
                        organizationId,
                        deletedAt: { $exists: false },
                        startTime: { $gte: periodStart },
                    },
                },

                // ── Stage 2: Accumulate raw counts and duration totals ───────
                {
                    $group: {
                        _id: null,

                        totalRuns: { $sum: 1 },

                        passedRuns: {
                            $sum: { $cond: [{ $eq: ['$status', 'PASSED'] }, 1, 0] },
                        },

                        // Only terminal-state runs count toward success rate.
                        finishedRuns: {
                            $sum: {
                                $cond: [{ $in: ['$status', [...FINISHED_STATUSES]] }, 1, 0],
                            },
                        },

                        // Sum durations (ms) only for runs that have an endTime.
                        // $subtract on two Dates yields milliseconds in MongoDB.
                        durationSum: {
                            $sum: {
                                $cond: [
                                    { $gt: ['$endTime', null] },
                                    { $subtract: ['$endTime', '$startTime'] },
                                    0,
                                ],
                            },
                        },

                        // Count how many runs contributed to durationSum.
                        durationCount: {
                            $sum: { $cond: [{ $gt: ['$endTime', null] }, 1, 0] },
                        },
                    },
                },

                // ── Stage 3: Derive computed fields ──────────────────────────
                {
                    $project: {
                        _id: 0,
                        totalRuns: 1,
                        passedRuns: 1,
                        finishedRuns: 1,
                        durationSum: 1,
                        durationCount: 1,
                    },
                },
            ];

            const [raw] = await executions.aggregate<IAggregationResult>(pipeline).toArray();

            // If no executions exist this month, return zeroed KPIs.
            if (!raw) {
                const kpis: IAnalyticsKPIs = {
                    totalRuns: 0,
                    passedRuns: 0,
                    finishedRuns: 0,
                    successRate: 0,
                    avgDurationMs: 0,
                    period,
                };
                return reply.send({ success: true, data: kpis });
            }

            // Derive success rate from finished runs only (avoids inflating with
            // in-progress RUNNING/PENDING/ANALYZING executions).
            const successRate =
                raw.finishedRuns > 0
                    ? Math.round((raw.passedRuns / raw.finishedRuns) * 1000) / 10 // 1 decimal
                    : 0;

            const avgDurationMs =
                raw.durationCount > 0
                    ? Math.round(raw.durationSum / raw.durationCount)
                    : 0;

            const kpis: IAnalyticsKPIs = {
                totalRuns: raw.totalRuns,
                passedRuns: raw.passedRuns,
                finishedRuns: raw.finishedRuns,
                successRate,
                avgDurationMs,
                period,
            };

            app.log.info(
                { organizationId, period, totalRuns: raw.totalRuns },
                '[analytics] KPIs computed',
            );

            return reply.send({ success: true, data: kpis });
        } catch (error: unknown) {
            app.log.error(error, '[analytics] Failed to compute KPIs');
            return reply.status(500).send({ success: false, error: 'Failed to compute analytics KPIs' });
        }
    });
}
