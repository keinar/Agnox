/**
 * Chat Pipeline Sanitizer
 *
 * Mandatory security layer that runs on EVERY LLM-generated MongoDB aggregation pipeline
 * before execution. Prevents NoSQL injection, data exfiltration, and cross-tenant access.
 *
 * Five layers in execution order:
 *   1. Stage allowlist          — reject disallowed pipeline stage operators.
 *   2. organizationId injection — guarantee tenant isolation regardless of LLM output.
 *   3. $limit enforcement       — cap rows returned to prevent runaway aggregations.
 *   4. Collection whitelist     — (validated by callers via `ALLOWED_COLLECTIONS`).
 *   5. Operator sanitization    — recursively reject illegal $ operator injection.
 */

import { ObjectId } from 'mongodb';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Aggregation stage operators the LLM is permitted to use. */
const ALLOWED_STAGE_OPERATORS = new Set([
    '$match',
    '$group',
    '$project',
    '$sort',
    '$limit',
    '$count',
    '$addFields',
    '$unwind',
    '$lookup',
    '$facet',
    '$bucket',
    '$bucketAuto',
    '$skip',
    '$replaceRoot',
    '$replaceWith',
]);

/** Stage operators that are explicitly blocked (write ops, JS execution, unbounded traversal). */
const BLOCKED_STAGE_OPERATORS = new Set([
    '$out',
    '$merge',
    '$unionWith',
    '$function',
    '$accumulator',
    '$where',
    '$graphLookup',
    '$indexStats',
    '$planCacheStats',
    '$currentOp',
    '$listLocalSessions',
    '$listSessions',
]);

/** Aggregation expression operators that are permitted inside stage values. */
const ALLOWED_EXPRESSION_OPERATORS = new Set([
    // Arithmetic
    '$add', '$subtract', '$multiply', '$divide', '$mod', '$abs', '$ceil', '$floor', '$round', '$sqrt', '$trunc',
    // Array
    '$arrayElemAt', '$concatArrays', '$filter', '$first', '$last', '$in', '$indexOfArray',
    '$isArray', '$map', '$reduce', '$reverseArray', '$size', '$slice', '$zip',
    '$elemMatch', '$all',
    // Boolean
    '$and', '$not', '$or', '$nor',
    // Comparison / query operators (used in $match stage values)
    '$cmp', '$eq', '$gt', '$gte', '$lt', '$lte', '$ne',
    // Query operators (field-level, used inside $match)
    '$exists', '$nin', '$regex', '$options', '$expr',
    // Conditional
    '$cond', '$ifNull', '$switch',
    // Date — CRITICAL: $dateFromString enables ISO-8601 string → Date coercion in pipelines
    '$dateFromString', '$dateToString', '$dayOfMonth', '$dayOfWeek', '$dayOfYear',
    '$hour', '$isoWeek', '$isoWeekYear', '$isoDayOfWeek', '$millisecond', '$minute',
    '$month', '$second', '$toDate', '$week', '$year', '$dateToParts', '$dateFromParts',
    '$dateDiff', '$dateAdd', '$dateSubtract', '$dateTrunc',
    // String
    '$concat', '$indexOfBytes', '$indexOfCP', '$ltrim', '$regexFind', '$regexFindAll',
    '$regexMatch', '$rtrim', '$split', '$strLenBytes', '$strLenCP', '$strcasecmp',
    '$substr', '$substrBytes', '$substrCP', '$toLower', '$toUpper', '$trim',
    // Type
    '$convert', '$isNumber', '$toBool', '$toDecimal', '$toDouble', '$toInt', '$toLong',
    '$toObjectId', '$toString', '$type',
    // Accumulator (used inside $group)
    '$avg', '$count', '$max', '$mergeObjects', '$min', '$push', '$stdDevPop', '$stdDevSamp', '$sum',
    '$firstN', '$lastN', '$maxN', '$minN', '$sortArray', '$bottom', '$top',
    // Miscellaneous
    '$literal', '$let', '$allElementsTrue', '$anyElementTrue', '$setDifference',
    '$setEquals', '$setIntersection', '$setIsSubset', '$setUnion',
    '$objectToArray', '$arrayToObject', '$getField', '$setField',
    '$range', '$zip', '$indexOfArray',
    // Field path
    '$$ROOT', '$$CURRENT', '$$REMOVE', '$$DESCEND', '$$PRUNE', '$$KEEP',
]);

const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 500;

/** Collections the chatbot is allowed to query. Callers validate this before calling aggregate(). */
export const ALLOWED_COLLECTIONS = new Set(['executions', 'test_cycles', 'test_cases']);

// ── Types ─────────────────────────────────────────────────────────────────────

export class PipelineSanitizationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PipelineSanitizationError';
    }
}

// ── Layer 5: Operator sanitization ────────────────────────────────────────────

/** ISO-8601 prefix pattern — matches strings the LLM emits for date literals. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

/**
 * Recursively walk every value in `node`.
 *
 * Two responsibilities:
 *   a) Operator allowlist — each '$'-prefixed key must be in the allowlist.
 *   b) ISO-8601 coercion — string values that look like dates are converted to
 *      native JS Date objects so MongoDB can compare them against stored BSON
 *      Dates. This bridges the JSON-string → BSON-Date gap without requiring
 *      the LLM to use $dateFromString.
 *
 * Throws PipelineSanitizationError on any operator violation.
 */
function sanitizeOperators(node: unknown, path: string): void {
    if (node === null || typeof node !== 'object') return;

    if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++) {
            const item = node[i];
            if (typeof item === 'string' && ISO_DATE_RE.test(item)) {
                const d = new Date(item);
                if (!isNaN(d.getTime())) { node[i] = d; continue; }
            }
            sanitizeOperators(item, `${path}[${i}]`);
        }
        return;
    }

    const obj = node as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
        if (key.startsWith('$')) {
            // Allow $$-prefixed system variables
            if (key.startsWith('$$')) {
                if (!ALLOWED_EXPRESSION_OPERATORS.has(key)) {
                    throw new PipelineSanitizationError(
                        `Disallowed system variable "${key}" at path "${path}.${key}"`,
                    );
                }
            } else if (
                !ALLOWED_STAGE_OPERATORS.has(key) &&
                !ALLOWED_EXPRESSION_OPERATORS.has(key)
            ) {
                throw new PipelineSanitizationError(
                    `Disallowed operator "${key}" at path "${path}.${key}"`,
                );
            }
        }

        const value = obj[key];
        // ── ISO-8601 auto-coercion ──────────────────────────────────────────
        // Convert date strings to native Date objects so that MongoDB can
        // compare them correctly against BSON ISODate fields.
        if (typeof value === 'string' && ISO_DATE_RE.test(value)) {
            const d = new Date(value);
            if (!isNaN(d.getTime())) {
                obj[key] = d;
                continue; // No need to recurse into a scalar Date
            }
        }
        sanitizeOperators(value, `${path}.${key}`);
    }
}

// ── Main sanitizer ─────────────────────────────────────────────────────────────

/**
 * Sanitize an LLM-generated MongoDB aggregation pipeline.
 *
 * @param pipeline       - The raw pipeline array from the LLM.
 * @param organizationId - The current user's organizationId (enforced into every query).
 * @returns A safe, tenant-isolated pipeline ready for `collection.aggregate()`.
 * @throws PipelineSanitizationError on any violation.
 */
export function sanitizePipeline(
    pipeline: unknown,
    organizationId: string,
): Record<string, unknown>[] {

    // ── Structural validation ──────────────────────────────────────────────────
    if (!Array.isArray(pipeline)) {
        throw new PipelineSanitizationError('Pipeline must be an array');
    }
    if (pipeline.length === 0) {
        throw new PipelineSanitizationError('Pipeline must not be empty');
    }
    if (pipeline.length > 20) {
        throw new PipelineSanitizationError('Pipeline exceeds maximum of 20 stages');
    }

    // ── Layer 1: Stage allowlist ───────────────────────────────────────────────
    //
    // Each stage must be an object with exactly one key that is an allowed operator.
    for (let i = 0; i < pipeline.length; i++) {
        const stage = pipeline[i];
        if (stage === null || typeof stage !== 'object' || Array.isArray(stage)) {
            throw new PipelineSanitizationError(`Stage ${i} must be a plain object`);
        }
        const keys = Object.keys(stage as Record<string, unknown>);
        if (keys.length !== 1) {
            throw new PipelineSanitizationError(
                `Stage ${i} must have exactly one key (got ${keys.join(', ')})`,
            );
        }
        const operator = keys[0];

        if (BLOCKED_STAGE_OPERATORS.has(operator)) {
            throw new PipelineSanitizationError(
                `Stage operator "${operator}" is explicitly blocked`,
            );
        }
        if (!ALLOWED_STAGE_OPERATORS.has(operator)) {
            throw new PipelineSanitizationError(
                `Stage operator "${operator}" is not in the allowlist`,
            );
        }
    }

    // Cast to working type after structural validation
    const stages = pipeline as Record<string, unknown>[];

    // ── Layer 2: Force organizationId into first $match ────────────────────────
    //
    // Find the first $match stage index.
    const firstMatchIdx = stages.findIndex((s) => '$match' in s);

    if (firstMatchIdx === -1) {
        // No $match exists — prepend one
        stages.unshift({
            $match: {
                organizationId: {
                    $in: [
                        organizationId,              // string storage format
                        new ObjectId(organizationId) // ObjectId storage format
                    ]
                }
            }
        });
    } else {
        const matchStage = stages[firstMatchIdx] as { $match: Record<string, unknown> };
        // Unconditionally overwrite organizationId — LLM cannot affect tenant isolation.
        // Use $in to match both string and ObjectId storage formats across collections.
        matchStage.$match.organizationId = {
            $in: [
                organizationId,              // string storage format
                new ObjectId(organizationId) // ObjectId storage format
            ]
        };

        // If the match was not already first, move it to position 0 to avoid full-collection scans
        if (firstMatchIdx > 0) {
            stages.splice(firstMatchIdx, 1);
            stages.unshift(matchStage);
        }
    }

    // ── Layer 3: Enforce $limit ────────────────────────────────────────────────
    const limitIdx = stages.findIndex((s) => '$limit' in s);

    if (limitIdx === -1) {
        // Append a default limit at the end
        stages.push({ $limit: DEFAULT_LIMIT });
    } else {
        const rawLimit = (stages[limitIdx] as { $limit: unknown }).$limit;
        if (typeof rawLimit !== 'number' || !Number.isInteger(rawLimit) || rawLimit < 1) {
            throw new PipelineSanitizationError(
                `$limit value must be a positive integer (got ${rawLimit})`,
            );
        }
        if (rawLimit > MAX_LIMIT) {
            // Clamp to maximum — do not reject; just enforce the cap
            (stages[limitIdx] as { $limit: number }).$limit = MAX_LIMIT;
        }
    }

    // ── Layer 5: Operator sanitization ────────────────────────────────────────
    //
    // (Layer 4 — collection whitelist — is enforced by the calling route via ALLOWED_COLLECTIONS)
    //
    // Recursively validate every key in the pipeline. Any '$'-prefixed key not in
    // the allowlist triggers a PipelineSanitizationError.
    sanitizeOperators(stages, 'pipeline');

    return stages;
}
