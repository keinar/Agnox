/**
 * Manual Execution Drawer (Sprint 9 — Quality Hub)
 *
 * Headless UI slide-over for interactively executing a manual test.
 * Displays the manualSteps as a checklist with inline PASS/FAIL/SKIP buttons.
 * When the user clicks "Complete Test", the overall item status is derived from
 * the individual step statuses and sent to the backend.
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import {
    X, Loader2, AlertCircle, CheckCircle2, XCircle, SkipForward,
    ClipboardCheck, ChevronRight, Clock, Eye,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

// ── Constants ─────────────────────────────────────────────────────────────────

const isProduction =
    window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_URL = isProduction ? import.meta.env.VITE_API_URL ?? '' : 'http://localhost:3000';

type StepStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'SKIPPED';

// ── Types ─────────────────────────────────────────────────────────────────────

interface IManualStep {
    id: string;
    action: string;
    expectedResult: string;
    status: StepStatus;
    comment?: string;
}

interface ManualExecutionDrawerProps {
    isOpen: boolean;
    cycleId: string;
    itemId: string;
    itemTitle: string;
    initialSteps: IManualStep[];
    /** Overall item status. When this is a terminal value (not PENDING or RUNNING)
     *  the drawer renders in read-only Review Mode instead of execution mode. */
    itemStatus?: string;
    onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Derive the overall item status from its step statuses. */
function deriveItemStatus(steps: IManualStep[]): 'PASSED' | 'FAILED' | 'SKIPPED' {
    if (steps.length === 0) return 'PASSED';
    const hasFailed = steps.some((s) => s.status === 'FAILED');
    if (hasFailed) return 'FAILED';
    const allSkipped = steps.every((s) => s.status === 'SKIPPED');
    if (allSkipped) return 'SKIPPED';
    return 'PASSED';
}

const STATUS_BUTTON_STYLES: Record<StepStatus, string> = {
    PENDING: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500',
    PASSED: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 ring-1 ring-green-300 dark:ring-green-700',
    FAILED: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 ring-1 ring-red-300 dark:ring-red-700',
    SKIPPED: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 ring-1 ring-amber-300 dark:ring-amber-700',
};

// ── Component ─────────────────────────────────────────────────────────────────

/** Status icon map for read-only review display */
const REVIEW_STATUS_ICONS: Record<string, React.ReactNode> = {
    PASSED: <CheckCircle2 size={12} className="text-green-600 dark:text-green-400" />,
    FAILED: <XCircle size={12} className="text-red-600 dark:text-red-400" />,
    SKIPPED: <SkipForward size={12} className="text-amber-600 dark:text-amber-400" />,
    PENDING: <Clock size={12} className="text-slate-400 dark:text-slate-500" />,
};

export function ManualExecutionDrawer({
    isOpen,
    cycleId,
    itemId,
    itemTitle,
    initialSteps,
    itemStatus,
    onClose,
}: ManualExecutionDrawerProps) {
    // Read-only review mode when the item has already reached a terminal state
    const isReadOnly = !!itemStatus && itemStatus !== 'PENDING' && itemStatus !== 'RUNNING';
    const { token } = useAuth();
    const queryClient = useQueryClient();

    const [steps, setSteps] = useState<IManualStep[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [activeStepIndex, setActiveStepIndex] = useState(0);

    // Reset state when drawer opens
    useEffect(() => {
        if (!isOpen) return;
        setSteps(initialSteps.map((s) => ({ ...s, status: s.status === 'PENDING' ? 'PENDING' : s.status })));
        setActiveStepIndex(0);
        setSaveError(null);
    }, [isOpen, initialSteps]);

    // ── Step actions ────────────────────────────────────────────────────────

    function setStepStatus(index: number, status: StepStatus) {
        setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, status } : s)));
        // Auto-advance to next pending step
        if (status !== 'PENDING') {
            const nextPending = steps.findIndex((s, i) => i > index && s.status === 'PENDING');
            if (nextPending !== -1) setActiveStepIndex(nextPending);
        }
    }

    // ── Complete handler ────────────────────────────────────────────────────

    async function handleComplete() {
        const allPending = steps.every((s) => s.status === 'PENDING');
        if (allPending) {
            setSaveError('Mark at least one step before completing.');
            return;
        }

        setSaveError(null);
        setIsSaving(true);

        const overallStatus = deriveItemStatus(steps);

        try {
            await axios.put(
                `${API_URL}/api/test-cycles/${cycleId}/items/${itemId}`,
                {
                    status: overallStatus,
                    manualSteps: steps,
                },
                { headers: { Authorization: `Bearer ${token}` } },
            );

            await queryClient.invalidateQueries({ queryKey: ['test-cycles'] });
            onClose();
        } catch (err: unknown) {
            const message =
                axios.isAxiosError(err)
                    ? err.response?.data?.error ?? err.message
                    : 'Failed to save manual execution.';
            setSaveError(message);
        } finally {
            setIsSaving(false);
        }
    }

    // ── Progress stats ──────────────────────────────────────────────────────

    const completed = steps.filter((s) => s.status !== 'PENDING').length;
    const passed = steps.filter((s) => s.status === 'PASSED').length;
    const failed = steps.filter((s) => s.status === 'FAILED').length;
    const progressPct = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0;

    // ── Render ──────────────────────────────────────────────────────────────

    return (
        <Transition show={isOpen}>
            <Dialog onClose={onClose} className="relative z-50">

                {/* Backdrop */}
                <TransitionChild
                    enter="transition-opacity duration-300 ease-out"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="transition-opacity duration-200 ease-in"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/70" aria-hidden="true" />
                </TransitionChild>

                {/* Panel */}
                <div className="fixed inset-0 overflow-hidden">
                    <div className="flex h-full items-stretch justify-end">
                        <TransitionChild
                            enter="transition-transform duration-300 ease-out"
                            enterFrom="translate-x-full"
                            enterTo="translate-x-0"
                            leave="transition-transform duration-200 ease-in"
                            leaveFrom="translate-x-0"
                            leaveTo="translate-x-full"
                        >
                            <DialogPanel className="relative flex h-full w-full flex-col bg-white dark:bg-gh-bg-dark border-l border-slate-200 dark:border-gh-border-dark shadow-2xl md:max-w-xl">

                                {/* ── Header ──────────────────────────── */}
                                <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-gh-border-dark shrink-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                        {isReadOnly
                                            ? <Eye size={18} className="shrink-0 text-slate-500 dark:text-slate-400" />
                                            : <ClipboardCheck size={18} className="shrink-0 text-green-600 dark:text-green-400" />
                                        }
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                                                    {isReadOnly ? 'Execution Review' : 'Manual Execution'}
                                                </h2>
                                                {isReadOnly && itemStatus && (
                                                    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${STATUS_BUTTON_STYLES[itemStatus as StepStatus] ?? STATUS_BUTTON_STYLES.PENDING}`}>
                                                        {REVIEW_STATUS_ICONS[itemStatus] ?? REVIEW_STATUS_ICONS.PENDING}
                                                        {itemStatus}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                                {itemTitle}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        aria-label="Close drawer"
                                        className="flex shrink-0 items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {/* ── Progress bar ────────────────────── */}
                                <div className="px-6 py-3 border-b border-slate-200 dark:border-gh-border-dark shrink-0">
                                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                                        <span>{completed}/{steps.length} steps completed</span>
                                        <div className="flex items-center gap-3">
                                            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                                <CheckCircle2 size={11} /> {passed}
                                            </span>
                                            <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                                                <XCircle size={11} /> {failed}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-green-500 dark:bg-green-400 transition-all duration-300"
                                            style={{ width: `${progressPct}%` }}
                                        />
                                    </div>
                                </div>

                                {/* ── Steps list ─────────────────────── */}
                                <div className="flex-1 overflow-y-auto">
                                    <div className="flex flex-col">
                                        {steps.map((step, index) => {
                                            const isActive = index === activeStepIndex;
                                            return (
                                                <div
                                                    key={step.id}
                                                    role="button"
                                                    tabIndex={0}
                                                    className={`flex flex-col gap-3 px-6 py-4 border-b border-slate-100 dark:border-gh-border-dark transition-colors ${isActive ? 'bg-blue-50/50 dark:bg-blue-950/10' : ''
                                                        }`}
                                                    onClick={() => setActiveStepIndex(index)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveStepIndex(index); }}
                                                >
                                                    {/* Step header */}
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0 mt-0.5">
                                                            {index + 1}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                                                {step.action}
                                                            </p>
                                                            {step.expectedResult && (
                                                                <div className="flex items-start gap-1.5 mt-1.5">
                                                                    <ChevronRight size={12} className="shrink-0 mt-0.5 text-slate-400 dark:text-slate-500" />
                                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                        <span className="font-medium">Expected:</span> {step.expectedResult}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Status section: read-only badge in review mode, action buttons in execute mode */}
                                                    <div className="flex items-center gap-2 pl-9">
                                                        {isReadOnly ? (
                                                            <>
                                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${STATUS_BUTTON_STYLES[step.status] ?? STATUS_BUTTON_STYLES.PENDING}`}>
                                                                    {REVIEW_STATUS_ICONS[step.status] ?? REVIEW_STATUS_ICONS.PENDING}
                                                                    {step.status}
                                                                </span>
                                                                {step.comment && (
                                                                    <p className="text-xs text-slate-500 dark:text-slate-400 italic truncate">
                                                                        &ldquo;{step.comment}&rdquo;
                                                                    </p>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); setStepStatus(index, 'PASSED'); }}
                                                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${step.status === 'PASSED' ? STATUS_BUTTON_STYLES.PASSED : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-green-50 dark:hover:bg-green-950/20 hover:text-green-600 dark:hover:text-green-400'
                                                                        }`}
                                                                >
                                                                    <CheckCircle2 size={12} /> Pass
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); setStepStatus(index, 'FAILED'); }}
                                                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${step.status === 'FAILED' ? STATUS_BUTTON_STYLES.FAILED : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 dark:hover:text-red-400'
                                                                        }`}
                                                                >
                                                                    <XCircle size={12} /> Fail
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); setStepStatus(index, 'SKIPPED'); }}
                                                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${step.status === 'SKIPPED' ? STATUS_BUTTON_STYLES.SKIPPED : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 hover:text-amber-600 dark:hover:text-amber-400'
                                                                        }`}
                                                                >
                                                                    <SkipForward size={12} /> Skip
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {steps.length === 0 && (
                                            <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400 dark:text-slate-500">
                                                <ClipboardCheck size={28} strokeWidth={1.5} />
                                                <p className="text-sm">No steps defined for this test.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ── Footer ──────────────────────────── */}
                                <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-slate-200 dark:border-gh-border-dark shrink-0">
                                    <div className="min-w-0">
                                        {!isReadOnly && saveError && (
                                            <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                                                <AlertCircle size={13} className="shrink-0" />
                                                {saveError}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        {isReadOnly ? (
                                            // Review mode: close only
                                            <button
                                                type="button"
                                                onClick={onClose}
                                                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                            >
                                                Close
                                            </button>
                                        ) : (
                                            // Execute mode: cancel + complete
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={onClose}
                                                    className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleComplete}
                                                    disabled={isSaving}
                                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors duration-150"
                                                >
                                                    {isSaving ? (
                                                        <>
                                                            <Loader2 size={14} className="animate-spin" />
                                                            Saving…
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckCircle2 size={14} />
                                                            Complete Test
                                                        </>
                                                    )}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                            </DialogPanel>
                        </TransitionChild>
                    </div>
                </div>

            </Dialog>
        </Transition>
    );
}
