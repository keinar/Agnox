import { MongoClient } from 'mongodb';
import { getDbName } from '../config/server.js';

const DB_NAME = getDbName();

/**
 * Fair Scheduling — compute an enqueue priority for a given organization.
 *
 * RabbitMQ priority queues deliver higher-numbered messages before lower ones.
 * We assign priority based on how many executions the organization currently
 * has in a RUNNING state:
 *
 *   0 running  → priority 10  (idle org gets head-of-line preference)
 *   1 running  → priority  8
 *   2 running  → priority  6
 *   3 running  → priority  4
 *   4 running  → priority  2
 *   5+ running → priority  1  (floor — never starved, but de-prioritised)
 *
 * The query hits an indexed { organizationId, status } path and is typically
 * sub-millisecond, so it does not meaningfully slow down the enqueue path.
 */
export async function computeOrgPriority(
    dbClient: MongoClient,
    organizationId: string,
): Promise<number> {
    try {
        const runningCount = await dbClient
            .db(DB_NAME)
            .collection('executions')
            .countDocuments({ organizationId, status: 'RUNNING' });

        return Math.max(1, 10 - runningCount * 2);
    } catch {
        // Fail open: default to lowest priority so a transient DB error
        // never blocks enqueueing entirely.
        return 1;
    }
}
