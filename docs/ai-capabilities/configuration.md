---
id: configuration
title: AI Configuration & BYOK
sidebar_position: 1
---

# AI Configuration & BYOK

The AI Quality Orchestrator is a suite of five opt-in AI features. This page explains how to enable features and configure your LLM provider, including how to supply your own API keys.

---

## Enabling AI Features

All AI features are **off by default** (opt-in model). Enable them individually in **Settings → Features** under the "AI Features" section.

| Feature | Feature Flag | Sidebar Item |
|---------|-------------|--------------|
| Auto-Bug Generator | `autoBugGeneration` | *(button in Investigation Hub)* |
| Flakiness Detective | `flakinessDetective` | Stability |
| Smart Test Optimizer | `testOptimizer` | *(button in Test Cases)* |
| Smart PR Routing | `prRouting` | *(toggle in Run Settings)* |
| Quality Chatbot | `qualityChatbot` | Ask AI |
| **Smart Analytics** | *(Project Setting)* | *(autoQuarantineEnabled toggle)* |

---

## Configuring AI — BYOK (Settings → Security)

Agnox ships with **platform-managed LLM keys** as a convenience. To use your own cloud account keys (zero extra cost to your Agnox plan), configure **Bring Your Own Key (BYOK)**:

1. Go to **Settings → Security** and scroll to the **AI Configuration** section.
2. Under **Default AI Model**, select the model all AI features will use by default:
   - `gemini-2.5-flash` *(default — fastest, best for most workloads)*
   - `gpt-4o`
   - `claude-3-5-sonnet`
3. For each provider you want to supply your own key for, locate its row in the **Bring Your Own Key** table:
   - Status shows **"Using Platform Default"** (grey) until a key is provided, or **"Configured"** (green) when your key is active.
   - Paste your API key into the masked input field and click **Save Key**.
   - To rotate or remove a key, click **Remove** — the platform fallback key is used immediately.
4. Click **Save Settings**.

### BYOK Provider Reference

| Setting | Options | Description |
|---------|---------|-------------|
| **Default AI Model** | `gemini-2.5-flash`, `gpt-4o`, `claude-3-5-sonnet` | Applied to all AI features unless overridden |
| **BYOK — Gemini** | Optional | Your Google AI Studio or Vertex AI key |
| **BYOK — OpenAI** | Optional | Your OpenAI platform key |
| **BYOK — Anthropic** | Optional | Your Anthropic Console key |

> **Security:** Keys are encrypted at rest using **AES-256-GCM** before being persisted in MongoDB. Plaintext keys are never stored, logged, or returned by any API response. The `resolveLlmConfig()` utility on the server is the **only** code path that decrypts a BYOK key, and only at the moment of an LLM call.

---

## Dual-Agent (Actor-Critic) Architecture

Several AI features use a **Dual-Agent pipeline** to deliver high-quality, hallucination-resistant output:

```
┌──────────────────────────────────────────────────────────────────┐
│  STEP 1: Analyzer (Actor)                                        │
│  Temperature: 0.4  — creative, generates suggestions             │
│  Output: Structured JSON                                         │
└───────────────────────────┬──────────────────────────────────────┘
                            │ structured output
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 2: Critic (Evaluator)                                      │
│  Temperature: 0.0  — deterministic, no creativity               │
│  Input: Raw evidence + Analyzer output                           │
│  Task: Validate every claim. Override hallucinated suggestions.  │
│  Output: Final developer-facing Markdown                         │
└──────────────────────────────────────────────────────────────────┘
```

**Why two passes?**
- The Analyzer (0.4 temperature) generates creative, detailed suggestions but can occasionally hallucinate file names or APIs not present in the logs.
- The Critic (0.0 temperature, fully deterministic) cross-checks every claim against raw evidence. Any suggestion not grounded in the provided data is overridden before it reaches you.
- This pattern prevents the most common failure mode of single-pass LLM analysis: confident but wrong answers.

Features using this pattern: **Root Cause Analysis**, **Auto-Bug Generator**, **Smart Test Optimizer**.

---

## Related

- [Auto-Bug Generator →](./auto-bug)
- [Flakiness Detective →](./flakiness-detective)
- [Smart Test Optimizer →](./test-optimizer)
- [Smart PR Routing →](./pr-routing)
- [Quality Chatbot →](./chatbot)
