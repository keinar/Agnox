/**
 * Notifier Utility
 *
 * Sends outbound webhook notifications (Slack Block Kit format) when a test
 * execution reaches a final status.  The HTTP call is intentionally fire-and-
 * forget — a failing webhook must never block the main execution flow.
 */

import { IExecution, IOrganization } from '../../../../packages/shared-types/index.js';
import { decrypt, IEncryptedPayload } from './encryption.js';

const DASHBOARD_URL = process.env.DASHBOARD_URL || process.env.FRONTEND_URL || 'https://agnox.dev';

/** Statuses that represent the end of an execution lifecycle. */
export const FINAL_EXECUTION_STATUSES = new Set(['PASSED', 'FAILED', 'ERROR', 'UNSTABLE']);

/** Minimal logger interface compatible with Fastify's built-in Pino logger. */
interface ILogger {
    info: (msg: string) => void;
    error: (obj: unknown, msg: string) => void;
}

/**
 * Map execution status to a Slack-friendly status emoji.
 */
function getStatusEmoji(status: string): string {
    if (status === 'PASSED') return '🟢';
    if (status === 'FAILED') return '🔴';
    return '⚠️';
}

/**
 * Resolve the Slack webhook URL from the org record.
 *
 * Supports both:
 *   - Encrypted payloads (IEncryptedPayload) — new records after Sprint 2
 *   - Legacy plaintext strings — existing records until Sprint 3 migration
 *
 * Returns null if no webhook is configured.
 */
function resolveWebhookUrl(raw: unknown): string | null {
    if (!raw) return null;

    // New encrypted payload (object with encrypted/iv/authTag)
    if (typeof raw === 'object' && raw !== null && 'encrypted' in raw && 'iv' in raw && 'authTag' in raw) {
        try {
            return decrypt(raw as IEncryptedPayload);
        } catch {
            return null; // Decryption failed — treat as unconfigured
        }
    }

    // Legacy plaintext string
    if (typeof raw === 'string' && raw.startsWith('https://')) {
        return raw;
    }

    return null;
}

/**
 * Send a Slack Block Kit notification for a completed test execution.
 *
 * Returns early (no-op) if the organization has no Slack webhook configured.
 * Any network or Slack API error is caught and logged — it will NOT throw.
 *
 * @param execution - The finished execution record.
 * @param org       - The owning organization (used to read slackWebhookUrl).
 * @param logger    - Fastify-compatible logger for structured output.
 */
export async function sendExecutionNotification(
    execution: IExecution,
    org: IOrganization,
    logger: ILogger
): Promise<void> {
    // SECURITY_PLAN §2.3 — resolve encrypted or legacy webhook URL
    const webhookUrl = resolveWebhookUrl(org.slackWebhookUrl);
    if (!webhookUrl) return;

    const allowedEvents = org.slackNotificationEvents ?? ['FAILED', 'ERROR', 'UNSTABLE'];
    if (!allowedEvents.includes(execution.status)) {
        logger.info(
            `[notifier] Notification skipped for execution ${execution.taskId} due to organization preferences (${execution.status})`
        );
        return;
    }

    const emoji = getStatusEmoji(execution.status);
    const deepLink = `${DASHBOARD_URL}/dashboard?drawerId=${execution.taskId}`;
    const trigger = (execution.trigger ?? 'manual').toUpperCase();
    const folder = execution.folder || 'all';

    // Build Block Kit blocks
    const blocks: unknown[] = [
        {
            type: 'header',
            text: {
                type: 'plain_text',
                text: `${emoji} Execution ${execution.status} — ${folder}`,
                emoji: true,
            },
        },
        {
            type: 'section',
            fields: [
                { type: 'mrkdwn', text: `*Status:*\n${emoji} ${execution.status}` },
                { type: 'mrkdwn', text: `*Triggered by:*\n${trigger}` },
                { type: 'mrkdwn', text: `*Environment:*\n${execution.config?.environment ?? 'N/A'}` },
                { type: 'mrkdwn', text: `*Folder:*\n${folder}` },
            ],
        },
    ];

    // Include a truncated AI analysis snippet for failed executions
    if (execution.status === 'FAILED' && execution.analysis) {
        const MAX_SNIPPET_LEN = 150;
        const snippet = execution.analysis.slice(0, MAX_SNIPPET_LEN);
        const ellipsis = execution.analysis.length > MAX_SNIPPET_LEN ? '...' : '';
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*AI Analysis:*\n${snippet}${ellipsis}`,
            },
        });
    }

    // Deep link CTA button
    blocks.push({
        type: 'actions',
        elements: [
            {
                type: 'button',
                text: { type: 'plain_text', text: 'View Investigation Hub', emoji: true },
                url: deepLink,
                action_id: 'view_investigation_hub',
            },
        ],
    });

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blocks }),
        });

        if (!response.ok) {
            logger.error(
                { httpStatus: response.status, taskId: execution.taskId },
                '[notifier] Slack webhook returned a non-OK response'
            );
        } else {
            logger.info(
                `[notifier] Slack notification delivered for execution ${execution.taskId} (${execution.status})`
            );
        }
    } catch (error: unknown) {
        // Intentionally swallowed — webhook failure is non-critical
        logger.error(error, '[notifier] Failed to deliver Slack webhook notification');
    }
}
