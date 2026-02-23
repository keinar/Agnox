import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MongoClient, ObjectId } from 'mongodb';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { getDbName } from '../config/server.js';
import { rabbitMqService } from '../rabbitmq.js';

const DB_NAME = getDbName();

// Zod Schema for the CI Trigger Payload
const CiTriggerRequestSchema = z.object({
    projectId: z.string().min(1),
    image: z.string().min(1),
    command: z.string().min(1),
    folder: z.string().optional().default('all'),
    config: z.object({
        environment: z.enum(['development', 'staging', 'production']),
        baseUrl: z.string().url().optional(),
        envVars: z.record(z.string(), z.string()).optional()
    }),
    ciContext: z.object({
        source: z.enum(['github', 'gitlab', 'azure', 'jenkins', 'webhook']),
        repository: z.string().optional(),
        prNumber: z.number().int().optional(),
        commitSha: z.string().optional()
    })
});

/**
 * CI/CD Integration Routes
 */
export async function ciRoutes(
    app: FastifyInstance,
    mongoClient: MongoClient,
    apiRateLimit: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
): Promise<void> {
    const db = mongoClient.db(DB_NAME);
    const projectsCollection = db.collection('projects');
    const cyclesCollection = db.collection('test_cycles');
    const executionsCollection = db.collection('executions');

    /**
     * POST /api/ci/trigger
     * Securely triggers an automated test cycle from an external CI/CD pipeline
     */
    app.post('/api/ci/trigger', { preHandler: [apiRateLimit] }, async (request, reply) => {
        const organizationId = request.user!.organizationId;

        // 1. Validate incoming payload against strict schema
        const parseResult = CiTriggerRequestSchema.safeParse(request.body);
        if (!parseResult.success) {
            return reply.status(400).send({
                success: false,
                error: 'Invalid payload',
                details: parseResult.error.format()
            });
        }

        const { projectId, image, command, folder, config, ciContext } = parseResult.data;

        try {
            // 2. Security Check: Ensure the project exists and belongs to the caller's organization
            const project = await projectsCollection.findOne({
                _id: new ObjectId(projectId),
                organizationId
            });

            if (!project) {
                return reply.status(404).send({
                    success: false,
                    error: 'Project not found or access denied'
                });
            }

            // Generate unique IDs for tracing
            const now = new Date();
            // Fallback generation logic since randomUUID() is standard but standard run ids use format: run-timestamp-shortRandomString
            const shortRandomString = randomUUID().replace(/-/g, '').substring(0, 8);
            const cycleId = new ObjectId();
            const cycleItemId = randomUUID();
            const taskId = `run-${now.getTime()}-${shortRandomString}`;

            // 3. Create the parent TestCycle natively tracking the CI context
            const cycleName = `CI Run: ${ciContext.repository || 'External'} ${ciContext.prNumber ? `#${ciContext.prNumber}` : ''}`;

            const newCycle = {
                _id: cycleId,
                organizationId,
                projectId,
                name: cycleName.trim(),
                status: 'PENDING',
                ciContext,
                items: [
                    {
                        id: cycleItemId,
                        testCaseId: 'ci-auto-generated',
                        type: 'AUTOMATED',
                        title: `Automated Execution (${image})`,
                        status: 'PENDING',
                        executionId: taskId
                    }
                ],
                summary: {
                    total: 1,
                    passed: 0,
                    failed: 0,
                    automationRate: 100
                },
                createdAt: now,
                createdBy: request.user!.userId
            };

            await cyclesCollection.insertOne(newCycle);

            // 4. Create the linked Execution Document
            const executionDoc = {
                taskId,
                organizationId,
                cycleId: cycleId.toString(),
                cycleItemId,
                image,
                command,
                status: 'PENDING',
                folder,
                startTime: now,
                config,
                tests: [],
                trigger: ciContext.source
            };

            await executionsCollection.insertOne(executionDoc);

            // 5. Publish to RabbitMQ to decouple worker processing
            const taskData = {
                taskId,
                organizationId,
                cycleId: cycleId.toString(),
                cycleItemId,
                image,
                command,
                folder,
                config,
                aiAnalysisEnabled: true // Assuming true for CI unless overridden
            };

            await rabbitMqService.sendToQueue(taskData);

            app.log.info({ organizationId, cycleId: cycleId.toString(), taskId }, '[ci] Successfully queued new CI test cycle');

            return reply.status(201).send({
                success: true,
                data: {
                    cycleId: cycleId.toString(),
                    taskId,
                    status: 'PENDING'
                }
            });

        } catch (error: any) {
            app.log.error(error, '[ci] Failed to trigger CI pipeline');
            return reply.status(500).send({
                success: false,
                error: 'Internal server error while triggering CI test cycle'
            });
        }
    });
}
