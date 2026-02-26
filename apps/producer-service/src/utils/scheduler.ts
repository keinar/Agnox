/**
 * Native CRON Scheduling Engine (Task 8.2)
 *
 * Responsibilities:
 *  - On startup: loads all active schedules from MongoDB and registers them with node-cron.
 *  - At runtime: exposes addScheduledJob() / removeScheduledJob() so the REST API
 *    can update the in-memory job registry without restarting the server.
 *  - On shutdown: stops every running task gracefully via stopAllJobs().
 *
 * Cron callback logic mirrors the manual execution path in routes.ts:
 *  - Constructs a task payload with trigger: 'cron'
 *  - Upserts an execution document in MongoDB
 *  - Pushes the message to the RabbitMQ test_queue
 */

import * as cron from 'node-cron';
import { MongoClient } from 'mongodb';
import { rabbitMqService } from '../rabbitmq.js';
import { getDbName } from '../config/server.js';
import type { ISchedule } from '../../../../packages/shared-types/index.js';

// Generate a unique task ID for cron-triggered executions without requiring uuid.
function generateTaskId(): string {
    return `cron-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// In-memory registry: scheduleId (string) → ScheduledTask
const activeJobs = new Map<string, cron.ScheduledTask>();

let _dbClient: MongoClient | null = null;

/**
 * Build and enqueue a single test execution triggered by the CRON scheduler.
 * Errors are caught internally so a failing push cannot crash the cron process.
 */
async function fireSchedule(schedule: ISchedule): Promise<void> {
    if (!_dbClient) return;

    const taskId = generateTaskId();
    const startTime = new Date();
    const DB_NAME = getDbName();

    // Inject server-side environment variables — mirrors the logic in test-cycles.ts.
    // (Deprecated) PLATFORM INJECTION of INJECT_ENV_VARS has been removed.
    const envVars: Record<string, string> = {};

    const taskPayload = {
        taskId,
        organizationId: schedule.organizationId,
        image: schedule.image,
        command: `Agnostic Execution Mode: Running [${schedule.folder}] via entrypoint.sh`,
        folder: schedule.folder || 'all',
        config: {
            environment: schedule.environment,
            baseUrl: schedule.baseUrl,
            retryAttempts: 2,
            envVars,
        },
        tests: [],
        trigger: 'cron' as const,
        groupName: schedule.name,
    };

    try {
        const collection = _dbClient.db(DB_NAME).collection('executions');
        await collection.updateOne(
            { taskId },
            {
                $set: {
                    taskId,
                    organizationId: schedule.organizationId,
                    image: schedule.image,
                    command: taskPayload.command,
                    status: 'PENDING',
                    folder: taskPayload.folder,
                    startTime,
                    config: taskPayload.config,
                    tests: [],
                    trigger: 'cron',
                    groupName: schedule.name,
                },
            },
            { upsert: true },
        );

        await rabbitMqService.sendToQueue(taskPayload);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[scheduler] Failed to fire schedule "${schedule.name}" (id: ${schedule._id}): ${message}`);
    }
}

/**
 * Register a single node-cron job for the given schedule document.
 * Skips registration if the expression is invalid.
 */
function registerJob(schedule: ISchedule): void {
    const id = schedule._id.toString();

    // Guard: do not double-register
    if (activeJobs.has(id)) return;

    if (!cron.validate(schedule.cronExpression)) {
        console.error(`[scheduler] Invalid cron expression for schedule "${schedule.name}" — skipping.`);
        return;
    }

    const task = cron.schedule(schedule.cronExpression, () => {
        fireSchedule(schedule).catch(() => {
            // Already caught inside fireSchedule; this is a final safety net.
        });
    });

    activeJobs.set(id, task);
}

/**
 * Load all active schedules from the database and register them as cron jobs.
 * Called once during server startup.
 */
export async function initScheduler(dbClient: MongoClient): Promise<void> {
    _dbClient = dbClient;

    const DB_NAME = getDbName();

    try {
        const schedules = await dbClient
            .db(DB_NAME)
            .collection<ISchedule>('schedules')
            .find({ isActive: true })
            .toArray();

        for (const schedule of schedules) {
            registerJob(schedule);
        }

        console.info(`[scheduler] Initialized with ${activeJobs.size} active job(s).`);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[scheduler] Failed to initialize schedules: ${message}`);
    }
}

/**
 * Dynamically add a new cron job after a schedule is created via the API.
 * Safe to call without restarting the server.
 */
export function addScheduledJob(schedule: ISchedule): void {
    registerJob(schedule);
}

/**
 * Dynamically stop and remove a cron job when a schedule is deleted via the API.
 */
export function removeScheduledJob(scheduleId: string): void {
    const task = activeJobs.get(scheduleId);
    if (task) {
        task.stop();
        activeJobs.delete(scheduleId);
    }
}

/**
 * Stop all registered cron jobs.
 * Must be called during graceful shutdown (SIGTERM / SIGINT).
 */
export function stopAllJobs(): void {
    for (const [id, task] of activeJobs.entries()) {
        task.stop();
        activeJobs.delete(id);
    }
    console.info('[scheduler] All cron jobs stopped.');
}
