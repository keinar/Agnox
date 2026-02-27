/**
 * Internal Monitoring API — GET /api/system/monitor-status
 *
 * Security model:
 *   - Intentionally bypasses JWT auth (added to globalAuth publicPrefixes).
 *   - Requires the `X-Agnox-Monitor-Secret` request header to match the
 *     MONITORING_SECRET_KEY environment variable.
 *   - Never returns tenant data — only infrastructure health metrics.
 */

import { FastifyInstance } from 'fastify';
import { MongoClient } from 'mongodb';
import { rabbitMqService } from '../rabbitmq.js';

// Validate the secret is present at startup so ops teams catch misconfiguration early.
const MONITORING_SECRET_KEY = process.env.MONITORING_SECRET_KEY;

if (!MONITORING_SECRET_KEY) {
    // Warn loudly but do not crash — the route will simply reject all requests.
    process.stderr.write(
        '[monitor-status] WARNING: MONITORING_SECRET_KEY is not set. ' +
        'All requests to /api/system/monitor-status will return 401.\n',
    );
}

export async function monitorStatusRoutes(
    app: FastifyInstance,
    dbClient: MongoClient,
): Promise<void> {
    app.get('/api/system/monitor-status', async (request, reply) => {
        // ── Auth: shared-secret header ──────────────────────────────────────────
        const providedSecret = request.headers['x-agnox-monitor-secret'];

        if (!MONITORING_SECRET_KEY || providedSecret !== MONITORING_SECRET_KEY) {
            app.log.warn(
                { ip: request.ip, url: request.url },
                '[monitor-status] Rejected request — missing or invalid X-Agnox-Monitor-Secret',
            );
            return reply.code(401).send({ success: false, error: 'Unauthorized' });
        }

        // ── RabbitMQ queue stats ────────────────────────────────────────────────
        let queueDepth = 0;
        let activeWorkers = 0;

        try {
            const queueStats = await rabbitMqService.getQueueStats();
            queueDepth = queueStats.messageCount;
            activeWorkers = queueStats.consumerCount;
        } catch (err: unknown) {
            app.log.warn({ err }, '[monitor-status] Failed to fetch RabbitMQ queue stats');
        }

        // ── MongoDB connectivity check ──────────────────────────────────────────
        let dbConnected = false;

        try {
            await dbClient.db().command({ ping: 1 });
            dbConnected = true;
        } catch (err: unknown) {
            app.log.warn({ err }, '[monitor-status] MongoDB ping failed');
        }

        // ── Response ────────────────────────────────────────────────────────────
        return reply.code(200).send({
            status: 'ok',
            timestamp: new Date().toISOString(),
            data: {
                queueDepth,
                activeWorkers,
                dbConnected,
            },
        });
    });
}
