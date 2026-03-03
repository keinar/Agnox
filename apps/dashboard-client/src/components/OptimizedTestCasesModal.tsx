/**
 * OptimizedTestCasesModal (Feature C — Smart Test Optimizer)
 *
 * Displays a side-by-side comparison of the original test steps vs. the
 * AI-generated BDD-formatted steps for each selected test case.
 *
 * The "Apply" button PATCHes the test case via PUT /api/test-cases/:id,
 * overwriting the old steps with the AI's optimized BDD steps.
 */

import { useState } from 'react';
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import axios from 'axios';
import {
    X, Sparkles, ChevronDown, ChevronRight, CheckCircle2,
    Loader2, AlertCircle, Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const isProduction =
    window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_URL = isProduction ? import.meta.env.VITE_API_URL ?? '' : 'http://localhost:3000';

// ── Types ─────────────────────────────────────────────────────────────────────

interface IOriginalStep {
    action: string;
    expectedResult: string;
    status?: string;
}

interface IOptimizedStep {
    action: string;
    expectedResult: string;
    status: 'PENDING';
}

export interface IOptimizedTestCase {
    originalId: string;
    title: string;
    originalSteps: IOriginalStep[];
    optimizedSteps: IOptimizedStep[];
    duplicatesRemoved: number;
    edgeCases: string[];
    rationale: string;
}

interface ITestCaseLookup {
    title: string;
    type: string;
    description?: string;
    suite?: string;
    preconditions?: string;
}

interface OptimizedTestCasesModalProps {
    isOpen: boolean;
    optimizedCases: IOptimizedTestCase[];
    onClose: () => void;
    onApplied: (appliedCount: number) => void;
    /** Map of originalId → original test case fields needed for the full PUT body. */
    testCasesLookup: Map<string, ITestCaseLookup>;
}

// ── BDD prefix badge ───────────────────────────────────────────────────────────

function BddBadge({ action }: { action: string }) {
    const lower = action.toLowerCase();
    if (lower.startsWith('given')) {
        return (
            <span className="inline-block shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 mr-1.5">
                Given
            </span>
        );
    }
    if (lower.startsWith('when')) {
        return (
            <span className="inline-block shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 mr-1.5">
                When
            </span>
        );
    }
    if (lower.startsWith('then')) {
        return (
            <span className="inline-block shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 mr-1.5">
                Then
            </span>
        );
    }
    return null;
}

// ── Single test case panel ─────────────────────────────────────────────────────

interface TestCasePanelProps {
    tc: IOptimizedTestCase;
    isApplied: boolean;
    isApplying: boolean;
    onApply: (id: string) => void;
}

function TestCasePanel({ tc, isApplied, isApplying, onApply }: TestCasePanelProps) {
    const [expanded, setExpanded] = useState(true);

    return (
        <div className="rounded-xl border border-slate-200 dark:border-gh-border-dark bg-white dark:bg-gh-bg-dark overflow-hidden">
            {/* Header */}
            <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-gh-bg-subtle-dark hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors text-left"
            >
                {expanded
                    ? <ChevronDown size={15} className="shrink-0 text-slate-400" />
                    : <ChevronRight size={15} className="shrink-0 text-slate-400" />}
                <span className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {tc.title}
                </span>
                {tc.duplicatesRemoved > 0 && (
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                        -{tc.duplicatesRemoved} duplicate{tc.duplicatesRemoved !== 1 ? 's' : ''}
                    </span>
                )}
                {isApplied && (
                    <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 size={10} />
                        Applied
                    </span>
                )}
            </button>

            {expanded && (
                <div className="px-4 py-4 flex flex-col gap-4">
                    {/* Rationale */}
                    {tc.rationale && (
                        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 text-xs text-violet-700 dark:text-violet-300">
                            <Info size={13} className="shrink-0 mt-0.5" />
                            <span>{tc.rationale}</span>
                        </div>
                    )}

                    {/* Side-by-side comparison */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Original steps */}
                        <div className="flex flex-col gap-2">
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Original ({tc.originalSteps.length} steps)
                            </p>
                            {tc.originalSteps.length === 0 ? (
                                <p className="text-xs text-slate-400 dark:text-slate-500 italic">No steps defined</p>
                            ) : (
                                <ol className="flex flex-col gap-1.5">
                                    {tc.originalSteps.map((step, i) => (
                                        <li key={i} className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-gh-bg-subtle-dark rounded-lg px-2.5 py-2 border border-slate-200 dark:border-gh-border-dark">
                                            <span className="font-medium text-slate-700 dark:text-slate-300 mr-1">{i + 1}.</span>
                                            {step.action}
                                            {step.expectedResult && (
                                                <p className="mt-0.5 text-slate-400 dark:text-slate-500 italic">
                                                    → {step.expectedResult}
                                                </p>
                                            )}
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </div>

                        {/* Optimized steps */}
                        <div className="flex flex-col gap-2">
                            <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
                                Optimized BDD ({tc.optimizedSteps.length} steps)
                            </p>
                            {tc.optimizedSteps.length === 0 ? (
                                <p className="text-xs text-slate-400 dark:text-slate-500 italic">No optimized steps</p>
                            ) : (
                                <ol className="flex flex-col gap-1.5">
                                    {tc.optimizedSteps.map((step, i) => (
                                        <li key={i} className="text-xs text-slate-600 dark:text-slate-400 bg-violet-50 dark:bg-violet-950/20 rounded-lg px-2.5 py-2 border border-violet-200 dark:border-violet-800">
                                            <BddBadge action={step.action} />
                                            {step.action}
                                            {step.expectedResult && (
                                                <p className="mt-0.5 text-slate-400 dark:text-slate-500 italic">
                                                    → {step.expectedResult}
                                                </p>
                                            )}
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </div>
                    </div>

                    {/* Edge cases */}
                    {tc.edgeCases.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Suggested Edge Cases
                            </p>
                            <ul className="flex flex-col gap-1">
                                {tc.edgeCases.map((ec, i) => (
                                    <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                                        <span className="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 dark:bg-amber-500" />
                                        {ec}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Apply button */}
                    <div className="flex justify-end pt-1">
                        <button
                            type="button"
                            onClick={() => onApply(tc.originalId)}
                            disabled={isApplied || isApplying || tc.optimizedSteps.length === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
                        >
                            {isApplying
                                ? <><Loader2 size={12} className="animate-spin" /> Applying…</>
                                : isApplied
                                    ? <><CheckCircle2 size={12} /> Applied</>
                                    : <><Sparkles size={12} /> Apply Optimization</>}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Main modal ─────────────────────────────────────────────────────────────────

export function OptimizedTestCasesModal({
    isOpen,
    optimizedCases,
    onClose,
    onApplied,
    testCasesLookup,
}: OptimizedTestCasesModalProps) {
    const { token } = useAuth();
    const [applyingId, setApplyingId]   = useState<string | null>(null);
    const [appliedIds, setAppliedIds]   = useState<Set<string>>(new Set());
    const [applyError, setApplyError]   = useState<string | null>(null);

    /** Shared PUT logic — builds the full body required by the backend endpoint. */
    async function applyTestCase(id: string): Promise<void> {
        const tc = optimizedCases.find(c => c.originalId === id);
        if (!tc) throw new Error('Test case not found');

        const original = testCasesLookup.get(id);
        if (!original) throw new Error('Original test case data not available — please refresh and try again');

        const body: Record<string, unknown> = {
            title: original.title,
            type: original.type,
            steps: tc.optimizedSteps,
        };
        if (original.description) body.description = original.description;
        if (original.suite) body.suite = original.suite;
        if (original.preconditions) body.preconditions = original.preconditions;

        await axios.put(
            `${API_URL}/api/test-cases/${id}`,
            body,
            { headers: { Authorization: `Bearer ${token}` } },
        );
    }

    async function handleApply(id: string) {
        setApplyError(null);
        setApplyingId(id);
        try {
            await applyTestCase(id);
            const newAppliedIds = new Set([...appliedIds, id]);
            setAppliedIds(newAppliedIds);
            onApplied(newAppliedIds.size);
        } catch (err: unknown) {
            const message = axios.isAxiosError(err)
                ? err.response?.data?.error ?? err.message
                : 'Failed to apply optimization';
            setApplyError(message);
        } finally {
            setApplyingId(null);
        }
    }

    async function handleApplyAll() {
        setApplyError(null);
        const pending = optimizedCases.filter(
            tc => !appliedIds.has(tc.originalId) && tc.optimizedSteps.length > 0,
        );
        const newlyApplied: string[] = [];
        for (const tc of pending) {
            setApplyingId(tc.originalId);
            try {
                await applyTestCase(tc.originalId);
                newlyApplied.push(tc.originalId);
            } catch (err: unknown) {
                const message = axios.isAxiosError(err)
                    ? err.response?.data?.error ?? err.message
                    : `Failed to apply "${tc.title}"`;
                setApplyError(message);
                break;
            }
        }
        setApplyingId(null);
        if (newlyApplied.length > 0) {
            const newAppliedIds = new Set([...appliedIds, ...newlyApplied]);
            setAppliedIds(newAppliedIds);
            onApplied(newAppliedIds.size);
            onClose();
        }
    }

    const pendingCount = optimizedCases.filter(
        tc => !appliedIds.has(tc.originalId) && tc.optimizedSteps.length > 0,
    ).length;

    return (
        <Transition show={isOpen}>
            <Dialog onClose={onClose} className="relative z-50">

                {/* Backdrop */}
                <TransitionChild
                    enter="transition-opacity duration-200 ease-out"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="transition-opacity duration-150 ease-in"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70" aria-hidden="true" />
                </TransitionChild>

                {/* Panel */}
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <TransitionChild
                        enter="transition-all duration-200 ease-out"
                        enterFrom="opacity-0 scale-95"
                        enterTo="opacity-100 scale-100"
                        leave="transition-all duration-150 ease-in"
                        leaveFrom="opacity-100 scale-100"
                        leaveTo="opacity-0 scale-95"
                    >
                        <DialogPanel className="w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-gh-bg-dark border border-slate-200 dark:border-gh-border-dark shadow-2xl">

                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-gh-border-dark shrink-0">
                                <div className="flex items-center gap-2">
                                    <Sparkles size={18} className="text-violet-600 dark:text-violet-400" />
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                            AI Test Optimizer — {optimizedCases.length} Test Case{optimizedCases.length !== 1 ? 's' : ''}
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            Review the AI-generated BDD optimizations and apply selectively.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    aria-label="Close modal"
                                    className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Error banner */}
                            {applyError && (
                                <div className="mx-6 mt-4 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-400 shrink-0">
                                    <AlertCircle size={13} className="shrink-0 mt-0.5" />
                                    <span>{applyError}</span>
                                </div>
                            )}

                            {/* Cases list */}
                            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
                                {optimizedCases.map(tc => (
                                    <TestCasePanel
                                        key={tc.originalId}
                                        tc={tc}
                                        isApplied={appliedIds.has(tc.originalId)}
                                        isApplying={applyingId === tc.originalId}
                                        onApply={handleApply}
                                    />
                                ))}
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-gh-border-dark shrink-0">
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {appliedIds.size} of {optimizedCases.length} applied
                                </p>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        {appliedIds.size > 0 ? 'Done' : 'Cancel'}
                                    </button>
                                    {pendingCount > 1 && (
                                        <button
                                            type="button"
                                            onClick={handleApplyAll}
                                            disabled={!!applyingId}
                                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                                        >
                                            {applyingId
                                                ? <><Loader2 size={14} className="animate-spin" /> Applying…</>
                                                : <><Sparkles size={14} /> Apply All ({pendingCount})</>}
                                        </button>
                                    )}
                                </div>
                            </div>

                        </DialogPanel>
                    </TransitionChild>
                </div>

            </Dialog>
        </Transition>
    );
}
