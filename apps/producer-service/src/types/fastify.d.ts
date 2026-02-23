import 'fastify';

/**
 * SECURITY_PLAN §1.2 — FastifyRequest augmentation.
 * `isWorkerCallback` is set to `true` by the worker-auth onRequest hook
 * after the shared secret is validated, signalling the JWT preHandler to skip.
 */
declare module 'fastify' {
    interface FastifyRequest {
        isWorkerCallback?: boolean;
    }
}
