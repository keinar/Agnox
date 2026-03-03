/**
 * LLM Config Resolver
 *
 * Single source of truth for resolving which API key and model to use
 * for any LLM call. Encapsulates the BYOK → platform-env fallback chain
 * so no route needs to duplicate this logic.
 *
 * Algorithm:
 *   1. Read org.aiConfig.defaultModel (fallback: 'gemini-2.5-flash').
 *   2. Derive the provider from the model name.
 *   3. Check org.aiConfig.byok[provider] — if present, decrypt and return key.
 *   4. If no BYOK key, fall back to platform env vars:
 *        gemini     → PLATFORM_GEMINI_API_KEY
 *        openai     → PLATFORM_OPENAI_API_KEY
 *        anthropic  → PLATFORM_ANTHROPIC_API_KEY
 *   5. If neither is available, throw LlmNotConfiguredError (caught by routes → 503).
 *
 * SECURITY: This is the ONLY place that calls decrypt() on BYOK keys.
 * The decrypted key must never be logged or persisted — it lives in memory only.
 */

import { decrypt, IEncryptedPayload } from './encryption.js';

// Local mirror of IAiConfig from shared-types — kept in sync with the shared definition.
interface IAiConfig {
    defaultModel: 'gemini-2.5-flash' | 'gpt-4o' | 'claude-3-5-sonnet';
    byok?: {
        gemini?:    IEncryptedPayload;
        openai?:    IEncryptedPayload;
        anthropic?: IEncryptedPayload;
    };
    updatedAt?: Date;
}

export type LlmProvider = 'gemini' | 'openai' | 'anthropic';

export interface IResolvedLlmConfig {
    model: string;
    apiKey: string;
    provider: LlmProvider;
}

export class LlmNotConfiguredError extends Error {
    constructor(provider: LlmProvider) {
        super(
            `No API key configured for provider "${provider}". ` +
            `Configure a BYOK key via /api/organization/ai-config or set the ` +
            `PLATFORM_${provider.toUpperCase()}_API_KEY environment variable.`,
        );
        this.name = 'LlmNotConfiguredError';
    }
}

const MODEL_TO_PROVIDER: Record<string, LlmProvider> = {
    'gemini-2.5-flash':   'gemini',
    'gpt-4o':             'openai',
    'claude-3-5-sonnet':  'anthropic',
};

const PLATFORM_ENV_KEY: Record<LlmProvider, string> = {
    gemini:    'PLATFORM_GEMINI_API_KEY',
    openai:    'PLATFORM_OPENAI_API_KEY',
    anthropic: 'PLATFORM_ANTHROPIC_API_KEY',
};

/**
 * Resolve the LLM model, provider, and API key for a given org's aiConfig.
 *
 * @param aiConfig - The org's aiConfig document (may be undefined for new orgs).
 * @returns Resolved model name, provider, and plaintext API key.
 * @throws LlmNotConfiguredError if no key is available for the resolved provider.
 */
export function resolveLlmConfig(aiConfig?: IAiConfig): IResolvedLlmConfig {
    const model    = aiConfig?.defaultModel ?? 'gemini-2.5-flash';
    const provider = MODEL_TO_PROVIDER[model] ?? 'gemini';

    // 1. Try BYOK
    const byokPayload: IEncryptedPayload | undefined = aiConfig?.byok?.[provider];
    if (byokPayload) {
        const apiKey = decrypt(byokPayload);
        return { model, apiKey, provider };
    }

    // 2. Fall back to platform environment variable
    const platformKey = process.env[PLATFORM_ENV_KEY[provider]];
    if (platformKey) {
        return { model, apiKey: platformKey, provider };
    }

    throw new LlmNotConfiguredError(provider);
}
