/**
 * AutoBugModal
 *
 * Displays the AI-generated structured bug report for a FAILED/ERROR execution.
 * The user can edit each field before submitting to Jira.
 *
 * Flow:
 *   ExecutionDrawer → POST /api/ai/generate-bug-report → AutoBugModal → CreateJiraTicketModal
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, AlertCircle, ChevronDown } from 'lucide-react';
import { CreateJiraTicketModal } from './CreateJiraTicketModal';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ICodePatch {
    file: string;
    suggestion: string;
}

export interface IBugReport {
    title: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    stepsToReproduce: string[];
    expectedBehavior: string;
    actualBehavior: string;
    codePatches: ICodePatch[];
    rawAnalysis: string;
}

interface AutoBugModalProps {
    execution: any;
    bugReport: IBugReport;
    onClose: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
    high:     'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
    medium:   'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
    low:      'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
};

const INPUT_CLASS =
    'w-full px-3 py-2 text-sm border border-slate-200 dark:border-gh-border-dark rounded-lg ' +
    'bg-white dark:bg-gh-bg-dark text-slate-900 dark:text-slate-100 ' +
    'placeholder-slate-400 dark:placeholder-slate-600 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition';

const TEXTAREA_CLASS = INPUT_CLASS + ' resize-y';

/** Builds the Jira description text from the edited bug report fields. */
function buildJiraDescription(report: IBugReport): string {
    const lines: string[] = [
        '*AI-Generated Bug Report — Agnox*',
        '',
        `*Severity:* ${report.severity.toUpperCase()}`,
        '',
        '*Steps to Reproduce:*',
        ...report.stepsToReproduce.map((s, i) => `${i + 1}. ${s}`),
        '',
        `*Expected Behavior:* ${report.expectedBehavior}`,
        '',
        `*Actual Behavior:* ${report.actualBehavior}`,
    ];

    if (report.codePatches.length > 0) {
        lines.push('', '*Suggested Code Changes:*');
        for (const patch of report.codePatches) {
            if (patch.file) lines.push(`*File:* \`${patch.file}\``);
            lines.push(`{code}${patch.suggestion}{code}`);
        }
    }

    if (report.rawAnalysis) {
        lines.push('', '*Root Cause Analysis:*', report.rawAnalysis);
    }

    return lines.join('\n');
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AutoBugModal({ execution, bugReport, onClose }: AutoBugModalProps) {
    const [title, setTitle]               = useState(bugReport.title);
    const [severity, setSeverity]         = useState(bugReport.severity);
    const [steps, setSteps]               = useState<string[]>(
        bugReport.stepsToReproduce.length > 0 ? bugReport.stepsToReproduce : [''],
    );
    const [expected, setExpected]         = useState(bugReport.expectedBehavior);
    const [actual, setActual]             = useState(bugReport.actualBehavior);
    const [patches, setPatches]           = useState<ICodePatch[]>(bugReport.codePatches);
    const [rawAnalysis]                   = useState(bugReport.rawAnalysis);
    const [showJira, setShowJira]         = useState(false);
    const [showRaw, setShowRaw]           = useState(false);

    // ── Step helpers ───────────────────────────────────────────────────────────

    const updateStep = (index: number, value: string) =>
        setSteps((prev) => prev.map((s, i) => (i === index ? value : s)));

    const addStep = () => setSteps((prev) => [...prev, '']);

    const removeStep = (index: number) =>
        setSteps((prev) => prev.filter((_, i) => i !== index));

    // ── Patch helpers ──────────────────────────────────────────────────────────

    const updatePatch = (index: number, field: keyof ICodePatch, value: string) =>
        setPatches((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));

    const removePatch = (index: number) =>
        setPatches((prev) => prev.filter((_, i) => i !== index));

    // ── Submit to Jira ────────────────────────────────────────────────────────
    // Builds the final bug report from the edited state and opens CreateJiraTicketModal.

    const currentReport: IBugReport = {
        title, severity: severity as IBugReport['severity'],
        stepsToReproduce: steps.filter((s) => s.trim()),
        expectedBehavior: expected,
        actualBehavior:   actual,
        codePatches:      patches,
        rawAnalysis,
    };

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose();
    };

    // ── Modal ─────────────────────────────────────────────────────────────────

    const modal = (
        <div
            role="button"
            tabIndex={-1}
            aria-label="Close modal"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 cursor-default"
            onClick={handleBackdropClick}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
        >
            <div className="relative w-full max-w-2xl bg-white dark:bg-gh-bg-dark rounded-2xl shadow-2xl border border-slate-200 dark:border-gh-border-dark flex flex-col max-h-[90vh]">

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-gh-border-dark flex-shrink-0">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            AI-Generated Bug Report
                        </h2>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{execution.taskId}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        aria-label="Close"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* ── Body ── */}
                <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

                    {/* Info callout */}
                    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs">
                        <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                        <span>Review and edit the AI-generated report before submitting to Jira.</span>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                            Bug Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={200}
                            className={INPUT_CLASS}
                        />
                    </div>

                    {/* Severity */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                            Severity
                        </label>
                        <div className="relative inline-block w-48">
                            <select
                                value={severity}
                                onChange={(e) => setSeverity(e.target.value as IBugReport['severity'])}
                                className={`w-full appearance-none pl-3 pr-8 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.high}`}
                            >
                                <option value="critical">Critical</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>
                            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-current opacity-60" />
                        </div>
                    </div>

                    {/* Steps to Reproduce */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                            Steps to Reproduce
                        </label>
                        <div className="space-y-2">
                            {steps.map((step, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-slate-400 w-5 flex-shrink-0 text-right">{i + 1}.</span>
                                    <input
                                        type="text"
                                        value={step}
                                        onChange={(e) => updateStep(i, e.target.value)}
                                        placeholder={`Step ${i + 1}`}
                                        className={INPUT_CLASS}
                                    />
                                    {steps.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeStep(i)}
                                            className="flex-shrink-0 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                            aria-label="Remove step"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={addStep}
                            className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                        >
                            <Plus size={13} /> Add step
                        </button>
                    </div>

                    {/* Expected / Actual */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                                Expected Behavior
                            </label>
                            <textarea
                                rows={4}
                                value={expected}
                                onChange={(e) => setExpected(e.target.value)}
                                className={TEXTAREA_CLASS}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                                Actual Behavior
                            </label>
                            <textarea
                                rows={4}
                                value={actual}
                                onChange={(e) => setActual(e.target.value)}
                                className={TEXTAREA_CLASS}
                            />
                        </div>
                    </div>

                    {/* Code patches (optional) */}
                    {patches.length > 0 && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                                Suggested Code Changes
                            </label>
                            <div className="space-y-3">
                                {patches.map((patch, i) => (
                                    <div key={i} className="rounded-lg border border-slate-200 dark:border-gh-border-dark p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <input
                                                type="text"
                                                value={patch.file}
                                                onChange={(e) => updatePatch(i, 'file', e.target.value)}
                                                placeholder="File path (optional)"
                                                className={INPUT_CLASS + ' text-xs font-mono'}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removePatch(i)}
                                                className="ml-2 flex-shrink-0 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                                aria-label="Remove patch"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <textarea
                                            rows={3}
                                            value={patch.suggestion}
                                            onChange={(e) => updatePatch(i, 'suggestion', e.target.value)}
                                            placeholder="Describe the fix or paste a code snippet"
                                            className={TEXTAREA_CLASS + ' text-xs font-mono'}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Raw Analysis (collapsible) */}
                    {rawAnalysis && (
                        <div>
                            <button
                                type="button"
                                onClick={() => setShowRaw((v) => !v)}
                                className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                            >
                                <ChevronDown
                                    size={13}
                                    className={`transition-transform duration-150 ${showRaw ? 'rotate-0' : '-rotate-90'}`}
                                />
                                {showRaw ? 'Hide' : 'Show'} Root Cause Analysis
                            </button>
                            {showRaw && (
                                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-gh-border-dark whitespace-pre-wrap">
                                    {rawAnalysis}
                                </p>
                            )}
                        </div>
                    )}

                </div>

                {/* ── Footer ── */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-gh-border-dark bg-slate-50 dark:bg-gh-bg-dark rounded-b-2xl flex-shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-gh-bg-dark border border-slate-200 dark:border-gh-border-dark rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowJira(true)}
                        className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Submit to Jira
                    </button>
                </div>

            </div>
        </div>
    );

    return (
        <>
            {createPortal(modal, document.body)}
            {showJira && (
                <CreateJiraTicketModal
                    execution={execution}
                    onClose={() => { setShowJira(false); onClose(); }}
                    initialSummary={`[Bug] ${currentReport.title}`}
                    initialDescription={buildJiraDescription(currentReport)}
                />
            )}
        </>
    );
}
