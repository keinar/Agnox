/**
 * Audit Log Service
 * 
 * Centralized, asynchronous audit logging for administrative actions.
 * Used for compliance and security monitoring.
 */

import { Db, ObjectId } from 'mongodb';

export interface IAuditLogEntry {
    timestamp: Date;
    organizationId: ObjectId;
    userId: ObjectId;
    userEmail: string;
    action: AuditAction;
    resource: AuditResource;
    resourceId?: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
}

export type AuditAction =
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'INVITE'
    | 'ROLE_CHANGE'
    | 'LOGIN'
    | 'LOGOUT'
    | 'BILLING_UPDATE'
    | 'PLAN_CHANGE'
    | 'SETTINGS_UPDATE';

export type AuditResource =
    | 'user'
    | 'organization'
    | 'invitation'
    | 'execution'
    | 'billing'
    | 'settings';

/**
 * Log an administrative action asynchronously
 * Fire-and-forget pattern - does not block the main request
 */
export async function logAuditEvent(
    db: Db,
    entry: Omit<IAuditLogEntry, 'timestamp'>
): Promise<void> {
    // Async fire-and-forget - do not await in calling code
    setImmediate(async () => {
        try {
            const auditCollection = db.collection('audit_logs');

            await auditCollection.insertOne({
                ...entry,
                timestamp: new Date(),
                organizationId: new ObjectId(entry.organizationId),
                userId: new ObjectId(entry.userId),
            });
        } catch (error) {
            // Log error but don't throw - audit logging should never break main flow
            console.error('[AuditLog] Failed to write audit log:', error);
        }
    });
}

/**
 * Query audit logs for an organization
 */
export async function getAuditLogs(
    db: Db,
    organizationId: string,
    options?: {
        limit?: number;
        offset?: number;
        action?: AuditAction;
        resource?: AuditResource;
        userId?: string;
        startDate?: Date;
        endDate?: Date;
    }
): Promise<IAuditLogEntry[]> {
    const auditCollection = db.collection('audit_logs');

    const query: Record<string, any> = {
        organizationId: new ObjectId(organizationId),
    };

    if (options?.action) query.action = options.action;
    if (options?.resource) query.resource = options.resource;
    if (options?.userId) query.userId = new ObjectId(options.userId);
    if (options?.startDate || options?.endDate) {
        query.timestamp = {};
        if (options.startDate) query.timestamp.$gte = options.startDate;
        if (options.endDate) query.timestamp.$lte = options.endDate;
    }

    const logs = await auditCollection
        .find(query)
        .sort({ timestamp: -1 })
        .skip(options?.offset || 0)
        .limit(options?.limit || 100)
        .toArray();

    return logs as unknown as IAuditLogEntry[];
}

/**
 * Create audit log indexes for performance
 * Call this during database initialization
 */
export async function createAuditLogIndexes(db: Db): Promise<void> {
    const auditCollection = db.collection('audit_logs');

    await auditCollection.createIndexes([
        { key: { organizationId: 1, timestamp: -1 } },
        { key: { organizationId: 1, action: 1 } },
        { key: { organizationId: 1, userId: 1 } },
        { key: { timestamp: 1 }, expireAfterSeconds: 365 * 24 * 60 * 60 } // 1 year TTL
    ]);
}
