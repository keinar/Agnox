import { FastifyInstance } from 'fastify';
import { verifyToken } from '../utils/jwt.js';
import { extractReportTokenPayload, REPORT_TOKEN_TTL } from '../utils/reportToken.js';

export async function reportRoutes(app: FastifyInstance) {
    app.get('/reports/:organizationId/:taskId/*', async (request, reply) => {
        const { organizationId: routeOrgId, taskId } = request.params as { organizationId: string; taskId: string };
        const file = (request.params as any)['*'] || 'index.html';

        let organizationId: string | null = null;
        let queryToken: string | null = null;

        // Try standard JWT Auth (Header)
        const authHeader = request.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const payload = await verifyToken(authHeader.substring(7));
                if (payload) {
                    organizationId = payload.organizationId;
                }
            } catch (err) { }
        }

        // Try Report Token (Query or Cookie) if JWT not present or failed
        if (!organizationId) {
            const urlObj = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
            queryToken = urlObj.searchParams.get('token');

            const cookieHeader = request.headers.cookie || '';
            const cookieToken = cookieHeader
                .split(';')
                .map(c => c.trim())
                .find(c => c.startsWith('report_token='))
                ?.split('=')[1] || null;

            const token = queryToken || cookieToken;

            if (!token) {
                return reply.status(401).send({ success: false, error: 'Report access requires a valid token or authentication' });
            }

            // BUG FIX 1: Try verifying as standard User JWT FIRST 
            try {
                const payload = await verifyToken(token);
                if (payload) {
                    organizationId = payload.organizationId;
                }
            } catch (err) { }

            // If standard JWT failed or wasn't present, try Report Token (HMAC)
            if (!organizationId) {
                const hmacPayload = extractReportTokenPayload(token, taskId);
                if (!hmacPayload) {
                    return reply.status(401).send({ success: false, error: 'Invalid or expired report token' });
                }
                organizationId = hmacPayload.orgId;
            }

            // Set cookie for sub-resources if the token came from query string
            if (queryToken) {
                const cookiePath = `/reports/${routeOrgId}/${taskId}/`;
                reply.header(
                    'Set-Cookie',
                    `report_token=${queryToken}; Path=${cookiePath}; Max-Age=${REPORT_TOKEN_TTL}; HttpOnly; SameSite=Lax`,
                );
            }
        }

        // Security Check (IDOR prevention)
        if (organizationId !== routeOrgId) {
            return reply.status(403).send({ success: false, error: 'Forbidden: Organization ID mismatch' });
        }

        // We have auth, serve the file natively using dynamic paths
        const actualPath = `${routeOrgId}/${taskId}/${file}`;
        return reply.sendFile(actualPath);
    });
}
