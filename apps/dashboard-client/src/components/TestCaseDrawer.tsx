/**
 * Test Case Drawer (Sprint 9 — Quality Hub)
 *
 * Slide-over drawer for creating AND editing manual test cases.
 * Includes a dynamic steps builder and an AI-powered step generator using Gemini.
 *
 * Dual mode:
 *  - Create mode: no initialData → empty form, calls POST /api/test-cases
 *  - Edit mode:   initialData set → pre-populated form, calls PUT /api/test-cases/:id
 *
 * Uses the same Headless UI Dialog + Transition pattern as ExecutionDrawer.
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import { X, Plus, Trash2, Sparkles, Loader2, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

// ── Constants ─────────────────────────────────────────────────────────────────

const isProduction =
    window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_URL = isProduction ? import.meta.env.VITE_API_URL ?? '' : 'http://localhost:3000';

// ── Types ─────────────────────────────────────────────────────────────────────

interface IStepDraft {
    /** Unique local key for React reconciliation — not sent to the API. */
    localId: string;
    action: string;
    expectedResult: string;
}

/** Shape of a test case passed in for edit mode. */
export interface ITestCaseInitialData {
    _id: string;
    title: string;
    description?: string;
    suite?: string;
    preconditions?: string;
    type: 'MANUAL' | 'AUTOMATED';
    steps?: Array<{ action: string; expectedResult: string }>;
}

interface TestCaseDrawerProps {
    isOpen: boolean;
    /** The project this test case belongs to. */
    projectId: string;
    onClose: () => void;
    /** Called after a successful save so the parent can refresh its list. */
    onSaved: () => void;
    /** When provided, the drawer operates in Edit mode. */
    initialData?: ITestCaseInitialData | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let _localIdCounter = 0;
function newLocalId(): string {
    return `step-${++_localIdCounter}`;
}

function buildEmptyStep(): IStepDraft {
    return { localId: newLocalId(), action: '', expectedResult: '' };
}

// ── Shared class strings ───────────────────────────────────────────────────────

const INPUT_CLASS =
    'w-full px-3 py-2 text-sm border border-slate-300 dark:border-gh-border-dark rounded-lg ' +
    'bg-white dark:bg-gh-bg-dark text-slate-900 dark:text-slate-200 ' +
    'placeholder-slate-400 dark:placeholder-slate-500 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition';

const TEXTAREA_CLASS =
    INPUT_CLASS + ' resize-none';

// ── Component ─────────────────────────────────────────────────────────────────

export function TestCaseDrawer({ isOpen, projectId, onClose, onSaved, initialData }: TestCaseDrawerProps) {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    const isEditMode = !!initialData;

    // ── Form state ──────────────────────────────────────────────────────────
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [suite, setSuite] = useState('');
    const [preconditions, setPreconditions] = useState('');
    const [steps, setSteps] = useState<IStepDraft[]>([buildEmptyStep()]);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // ── AI generation state ─────────────────────────────────────────────────
    const [aiPanelOpen, setAiPanelOpen] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    // ── Populate form when opening in edit mode ─────────────────────────────
    useEffect(() => {
        if (!isOpen) return;

        if (initialData) {
            setTitle(initialData.title);
            setDescription(initialData.description ?? '');
            setSuite(initialData.suite ?? '');
            setPreconditions(initialData.preconditions ?? '');

            if (initialData.steps && initialData.steps.length > 0) {
                setSteps(
                    initialData.steps.map((s) => ({
                        localId: newLocalId(),
                        action: s.action,
                        expectedResult: s.expectedResult,
                    })),
                );
            } else {
                setSteps([buildEmptyStep()]);
            }
        } else {
            // Create mode — ensure clean slate
            setTitle('');
            setDescription('');
            setSuite('');
            setPreconditions('');
            setSteps([buildEmptyStep()]);
        }

        setSaveError(null);
        setAiPanelOpen(false);
        setAiPrompt('');
        setAiError(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, initialData]);

    // ── Step mutations ──────────────────────────────────────────────────────

    function addStep() {
        setSteps((prev) => [...prev, buildEmptyStep()]);
    }

    function removeStep(localId: string) {
        setSteps((prev) => {
            const next = prev.filter((s) => s.localId !== localId);
            // Always keep at least one empty step row
            return next.length > 0 ? next : [buildEmptyStep()];
        });
    }

    function updateStep(localId: string, field: 'action' | 'expectedResult', value: string) {
        setSteps((prev) =>
            prev.map((s) => (s.localId === localId ? { ...s, [field]: value } : s)),
        );
    }

    // ── AI generation ───────────────────────────────────────────────────────

    async function handleGenerateSteps() {
        if (!aiPrompt.trim()) return;
        setIsGenerating(true);
        setAiError(null);

        try {
            const { data } = await axios.post(
                `${API_URL}/api/ai/generate-test-steps`,
                { prompt: aiPrompt.trim() },
                { headers: { Authorization: `Bearer ${token}` } },
            );

            if (!data.success) {
                setAiError(data.error ?? 'AI generation failed.');
                return;
            }

            const generatedSteps: IStepDraft[] = (
                data.data.steps as Array<{ action: string; expectedResult: string }>
            ).map((s) => ({
                localId: newLocalId(),
                action: s.action,
                expectedResult: s.expectedResult,
            }));

            // Replace all current steps with the AI-generated ones
            setSteps(generatedSteps.length > 0 ? generatedSteps : [buildEmptyStep()]);
            setAiPanelOpen(false);
            setAiPrompt('');
        } catch (err: unknown) {
            const message =
                axios.isAxiosError(err)
                    ? err.response?.data?.error ?? err.message
                    : 'Unexpected error during AI generation.';
            setAiError(message);
        } finally {
            setIsGenerating(false);
        }
    }

    // ── Save handler ────────────────────────────────────────────────────────

    async function handleSave() {
        setSaveError(null);

        if (!title.trim()) {
            setSaveError('Title is required.');
            return;
        }

        // Filter out completely empty step rows before sending
        const nonEmptySteps = steps.filter(
            (s) => s.action.trim().length > 0 && s.expectedResult.trim().length > 0,
        );

        setIsSaving(true);
        try {
            const payload = {
                projectId,
                title: title.trim(),
                description: description.trim() || undefined,
                suite: suite.trim() || undefined,
                preconditions: preconditions.trim() || undefined,
                type: 'MANUAL',
                steps: nonEmptySteps.map((s) => ({
                    action: s.action.trim(),
                    expectedResult: s.expectedResult.trim(),
                    status: 'PENDING',
                })),
            };

            if (isEditMode && initialData) {
                // Edit mode — PUT request
                await axios.put(
                    `${API_URL}/api/test-cases/${initialData._id}`,
                    payload,
                    { headers: { Authorization: `Bearer ${token}` } },
                );
            } else {
                // Create mode — POST request
                await axios.post(
                    `${API_URL}/api/test-cases`,
                    payload,
                    { headers: { Authorization: `Bearer ${token}` } },
                );
            }

            // Invalidate the test-cases query cache so the list refreshes
            await queryClient.invalidateQueries({ queryKey: ['test-cases'] });

            onSaved();
            onClose();
        } catch (err: unknown) {
            const message =
                axios.isAxiosError(err)
                    ? err.response?.data?.error ?? err.message
                    : `Failed to ${isEditMode ? 'update' : 'create'} test case.`;
            setSaveError(message);
        } finally {
            setIsSaving(false);
        }
    }

    // ── Render ──────────────────────────────────────────────────────────────

    return (
        <Transition show={isOpen}>
            <Dialog onClose={onClose} className="relative z-50">

                {/* ── Backdrop ──────────────────────────────────────────── */}
                <TransitionChild
                    enter="transition-opacity duration-300 ease-out"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="transition-opacity duration-200 ease-in"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div
                        className="fixed inset-0 bg-slate-900/50 dark:bg-black/70"
                        aria-hidden="true"
                    />
                </TransitionChild>

                {/* ── Slide panel ───────────────────────────────────────── */}
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
                            <DialogPanel className="relative flex h-full w-full flex-col bg-white dark:bg-gh-bg-dark border-l border-slate-200 dark:border-gh-border-dark shadow-2xl md:max-w-2xl">

                                {/* ── Header ────────────────────────────── */}
                                <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-gh-border-dark shrink-0">
                                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        {isEditMode ? 'Edit Test Case' : 'Create Manual Test Case'}
                                    </h2>
                                    <button
                                        onClick={onClose}
                                        aria-label="Close drawer"
                                        className="flex shrink-0 items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors duration-150"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {/* ── Body ──────────────────────────────── */}
                                <div className="flex-1 overflow-y-auto">
                                    <div className="flex flex-col gap-6 px-6 py-5">

                                        {/* Title */}
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                                Title <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={title}
                                                onChange={(e) => setTitle(e.target.value)}
                                                placeholder="e.g. Login with invalid credentials"
                                                maxLength={200}
                                                className={INPUT_CLASS}
                                            />
                                        </div>

                                        {/* Suite / Module */}
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                                Suite / Module
                                            </label>
                                            <input
                                                type="text"
                                                value={suite}
                                                onChange={(e) => setSuite(e.target.value)}
                                                placeholder="e.g. Login, Checkout, User Profile"
                                                maxLength={100}
                                                className={INPUT_CLASS}
                                            />
                                        </div>

                                        {/* Description */}
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                                Description
                                            </label>
                                            <textarea
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                placeholder="Optional — describe the goal or context of this test case"
                                                rows={2}
                                                className={TEXTAREA_CLASS}
                                            />
                                        </div>

                                        {/* Preconditions */}
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                                Preconditions
                                            </label>
                                            <textarea
                                                value={preconditions}
                                                onChange={(e) => setPreconditions(e.target.value)}
                                                placeholder="e.g. User must be logged in, Test data populated"
                                                rows={2}
                                                className={TEXTAREA_CLASS}
                                            />
                                        </div>

                                        {/* ── AI Magic Section ─────────────── */}
                                        <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20 overflow-hidden">
                                            <button
                                                type="button"
                                                onClick={() => setAiPanelOpen((v) => !v)}
                                                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-violet-100 dark:hover:bg-violet-950/40"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Sparkles
                                                        size={16}
                                                        className="text-violet-600 dark:text-violet-400 shrink-0"
                                                    />
                                                    <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
                                                        Generate steps with AI
                                                    </span>
                                                </div>
                                                {aiPanelOpen ? (
                                                    <ChevronUp size={16} className="text-violet-500 shrink-0" />
                                                ) : (
                                                    <ChevronDown size={16} className="text-violet-500 shrink-0" />
                                                )}
                                            </button>

                                            {aiPanelOpen && (
                                                <div className="px-4 pb-4 flex flex-col gap-3 border-t border-violet-200 dark:border-violet-800 pt-3">
                                                    <p className="text-xs text-violet-600 dark:text-violet-400">
                                                        Describe the scenario and Gemini will generate the test steps.
                                                        This will <strong>replace</strong> any existing steps.
                                                    </p>
                                                    <textarea
                                                        value={aiPrompt}
                                                        onChange={(e) => setAiPrompt(e.target.value)}
                                                        placeholder="e.g. Login flow with invalid credentials — user enters wrong password three times and gets locked out"
                                                        rows={3}
                                                        className={TEXTAREA_CLASS}
                                                    />
                                                    {aiError && (
                                                        <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                                                            <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                                            <span>{aiError}</span>
                                                        </div>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={handleGenerateSteps}
                                                        disabled={isGenerating || !aiPrompt.trim()}
                                                        className="self-start flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors duration-150"
                                                    >
                                                        {isGenerating ? (
                                                            <>
                                                                <Loader2 size={14} className="animate-spin" />
                                                                Generating…
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Sparkles size={14} />
                                                                Generate steps
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* ── Steps Builder ────────────────── */}
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                                    Test Steps
                                                    <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] normal-case font-normal">
                                                        {steps.length}
                                                    </span>
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={addStep}
                                                    className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                                                >
                                                    <Plus size={14} />
                                                    Add step
                                                </button>
                                            </div>

                                            <div className="flex flex-col gap-3">
                                                {steps.map((step, index) => (
                                                    <div
                                                        key={step.localId}
                                                        className="flex flex-col gap-2 p-3 rounded-lg border border-slate-200 dark:border-gh-border-dark bg-slate-50 dark:bg-gh-bg-subtle-dark"
                                                    >
                                                        {/* Step header */}
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                                                                Step {index + 1}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => removeStep(step.localId)}
                                                                aria-label={`Remove step ${index + 1}`}
                                                                className="flex items-center justify-center w-6 h-6 rounded text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>

                                                        {/* Action */}
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                                                Action
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={step.action}
                                                                onChange={(e) =>
                                                                    updateStep(step.localId, 'action', e.target.value)
                                                                }
                                                                placeholder="Describe the action to perform"
                                                                className={INPUT_CLASS}
                                                            />
                                                        </div>

                                                        {/* Expected result */}
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                                                Expected Result
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={step.expectedResult}
                                                                onChange={(e) =>
                                                                    updateStep(step.localId, 'expectedResult', e.target.value)
                                                                }
                                                                placeholder="Describe the expected outcome"
                                                                className={INPUT_CLASS}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Footer ────────────────────────────── */}
                                <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-slate-200 dark:border-gh-border-dark shrink-0">
                                    <div className="min-w-0">
                                        {saveError && (
                                            <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                                                <AlertCircle size={13} className="shrink-0" />
                                                {saveError}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSave}
                                            disabled={isSaving || !title.trim()}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors duration-150"
                                        >
                                            {isSaving ? (
                                                <>
                                                    <Loader2 size={14} className="animate-spin" />
                                                    Saving…
                                                </>
                                            ) : (
                                                isEditMode ? 'Update Test Case' : 'Save Test Case'
                                            )}
                                        </button>
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
