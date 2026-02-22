/**
 * Cycle Builder Drawer (Sprint 9 — Quality Hub)
 *
 * Slide-over drawer for composing a new hybrid test cycle.
 * Allows the user to:
 *  1. Name the cycle
 *  2. Select manual test cases (grouped by suite, with checkboxes)
 *  3. Optionally include an automated test run (folder/script path)
 *  4. Launch the cycle — POST /api/test-cycles
 *
 * Uses the same Headless UI Dialog + Transition pattern as TestCaseDrawer.
 */

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import {
    X, Loader2, AlertCircle, Sparkles, FolderOpen, FolderClosed,
    ChevronDown, ChevronRight, CheckSquare, Square, Layers,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

// ── Constants ─────────────────────────────────────────────────────────────────

const isProduction =
    window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_URL = isProduction ? import.meta.env.VITE_API_URL ?? '' : 'http://localhost:3000';

const UNCATEGORIZED_KEY = 'Uncategorized';

const INPUT_CLASS =
    'w-full px-3 py-2 text-sm border border-slate-300 dark:border-gh-border-dark rounded-lg ' +
    'bg-white dark:bg-gh-bg-dark text-slate-900 dark:text-slate-200 ' +
    'placeholder-slate-400 dark:placeholder-slate-500 ' +
    'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ITestCaseOption {
    _id: string;
    title: string;
    description?: string;
    suite?: string;
    type: 'MANUAL' | 'AUTOMATED';
    steps?: Array<{ action: string; expectedResult: string }>;
}

interface CycleBuilderDrawerProps {
    isOpen: boolean;
    projectId: string;
    onClose: () => void;
    onCreated: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CycleBuilderDrawer({ isOpen, projectId, onClose, onCreated }: CycleBuilderDrawerProps) {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    // ── Form state ──────────────────────────────────────────────────────────
    const [cycleName, setCycleName] = useState('');
    const [selectedTestIds, setSelectedTestIds] = useState<Set<string>>(new Set());
    const [expandedSuites, setExpandedSuites] = useState<Record<string, boolean>>({});

    // ── Automated section state ─────────────────────────────────────────────
    const [includeAutomated, setIncludeAutomated] = useState(false);
    const [automatedFolder, setAutomatedFolder] = useState('all');

    // ── Save state ──────────────────────────────────────────────────────────
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // ── Fetch test cases for checkbox selection ─────────────────────────────
    const { data: testCasesData, isLoading: testCasesLoading } = useQuery<{ testCases: ITestCaseOption[] }>({
        queryKey: ['test-cases', projectId, token],
        queryFn: async () => {
            const { data } = await axios.get(
                `${API_URL}/api/test-cases?projectId=${projectId}`,
                { headers: { Authorization: `Bearer ${token}` } },
            );
            return data.data;
        },
        enabled: !!token && !!projectId && isOpen,
        staleTime: 30_000,
    });

    const testCases = testCasesData?.testCases ?? [];

    // ── Fetch project settings for automated config ─────────────────────────
    const { data: projectSettings } = useQuery<{ image: string; baseUrl: string; folder: string } | null>({
        queryKey: ['project-settings', token],
        queryFn: async () => {
            const response = await fetch(`${API_URL}/api/project-settings`, {
                headers: { Authorization: `Bearer ${token!}` },
            });
            if (!response.ok) return null;
            const data = await response.json();
            if (!data.success || !data.settings) return null;

            const { settings } = data;
            const defaultBaseUrl =
                settings.targetUrls?.prod ||
                settings.targetUrls?.staging ||
                settings.targetUrls?.dev ||
                '';

            return {
                image: settings.dockerImage || '',
                baseUrl: defaultBaseUrl,
                folder: settings.defaultTestFolder || 'all',
            };
        },
        enabled: !!token && isOpen,
        staleTime: 5 * 60 * 1000,
    });

    const hasRunSettings = !!projectSettings?.image;

    // ── Group test cases by suite ───────────────────────────────────────────
    const grouped = useMemo(() => {
        const groups: Record<string, ITestCaseOption[]> = {};
        for (const tc of testCases) {
            const key = tc.suite?.trim() || UNCATEGORIZED_KEY;
            if (!groups[key]) groups[key] = [];
            groups[key].push(tc);
        }
        return groups;
    }, [testCases]);

    const suiteNames = useMemo(() => {
        const keys = Object.keys(grouped);
        return keys.sort((a, b) => {
            if (a === UNCATEGORIZED_KEY) return 1;
            if (b === UNCATEGORIZED_KEY) return -1;
            return a.localeCompare(b);
        });
    }, [grouped]);

    // ── Reset form when drawer opens/closes ─────────────────────────────────
    useEffect(() => {
        if (!isOpen) return;
        setCycleName('');
        setSelectedTestIds(new Set());
        setExpandedSuites({});
        setIncludeAutomated(false);
        setAutomatedFolder(projectSettings?.folder ?? 'all');
        setSaveError(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // ── Selection helpers ───────────────────────────────────────────────────

    function isSuiteExpanded(name: string): boolean {
        return expandedSuites[name] !== false;
    }

    function toggleSuiteExpanded(name: string) {
        setExpandedSuites((prev) => ({ ...prev, [name]: !isSuiteExpanded(name) }));
    }

    function toggleTestCase(id: string) {
        setSelectedTestIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function toggleSuiteSelection(suiteName: string) {
        const cases = grouped[suiteName] ?? [];
        const caseIds = cases.map((tc) => tc._id);
        const allSelected = caseIds.every((id) => selectedTestIds.has(id));

        setSelectedTestIds((prev) => {
            const next = new Set(prev);
            if (allSelected) {
                caseIds.forEach((id) => next.delete(id));
            } else {
                caseIds.forEach((id) => next.add(id));
            }
            return next;
        });
    }

    function isSuiteFullySelected(suiteName: string): boolean {
        const cases = grouped[suiteName] ?? [];
        return cases.length > 0 && cases.every((tc) => selectedTestIds.has(tc._id));
    }

    function isSuitePartiallySelected(suiteName: string): boolean {
        const cases = grouped[suiteName] ?? [];
        const selected = cases.filter((tc) => selectedTestIds.has(tc._id));
        return selected.length > 0 && selected.length < cases.length;
    }

    // ── Launch handler ──────────────────────────────────────────────────────

    async function handleLaunch() {
        setSaveError(null);

        if (!cycleName.trim()) {
            setSaveError('Cycle name is required.');
            return;
        }
        if (selectedTestIds.size === 0 && !includeAutomated) {
            setSaveError('Select at least one manual test or enable the automated section.');
            return;
        }

        setIsSaving(true);
        try {
            // Build manual items from selected test cases
            const manualItems = testCases
                .filter((tc) => selectedTestIds.has(tc._id))
                .map((tc) => ({
                    testCaseId: tc._id,
                    type: 'MANUAL' as const,
                    title: tc.title,
                    status: 'PENDING' as const,
                    manualSteps: tc.steps?.map((s) => ({
                        action: s.action,
                        expectedResult: s.expectedResult,
                        status: 'PENDING' as const,
                    })) ?? [],
                }));

            // Build automated item (single item representing the automated run)
            const automatedItems = includeAutomated && hasRunSettings
                ? [{
                    testCaseId: `automated-${Date.now()}`,
                    type: 'AUTOMATED' as const,
                    title: `Automated Run — ${automatedFolder === 'all' ? 'All Tests' : automatedFolder}`,
                    status: 'PENDING' as const,
                }]
                : [];

            const payload: Record<string, unknown> = {
                projectId,
                name: cycleName.trim(),
                items: [...manualItems, ...automatedItems],
            };

            // Include automated execution config if needed
            if (automatedItems.length > 0 && projectSettings) {
                payload.image = projectSettings.image;
                payload.baseUrl = projectSettings.baseUrl;
                payload.folder = automatedFolder;
            }

            await axios.post(`${API_URL}/api/test-cycles`, payload, {
                headers: { Authorization: `Bearer ${token}` },
            });

            await queryClient.invalidateQueries({ queryKey: ['test-cycles'] });
            onCreated();
            onClose();
        } catch (err: unknown) {
            const message =
                axios.isAxiosError(err)
                    ? err.response?.data?.error ?? err.message
                    : 'Failed to create test cycle.';
            setSaveError(message);
        } finally {
            setIsSaving(false);
        }
    }

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

                {/* Slide panel */}
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
                                    <div className="flex items-center gap-2">
                                        <Layers size={18} className="text-violet-600 dark:text-violet-400" />
                                        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                            Create Hybrid Test Cycle
                                        </h2>
                                    </div>
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

                                        {/* Cycle Name */}
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                                Cycle Name <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={cycleName}
                                                onChange={(e) => setCycleName(e.target.value)}
                                                placeholder="e.g. v2.0 Regression, Sprint 14 Smoke"
                                                maxLength={200}
                                                className={INPUT_CLASS}
                                                autoFocus
                                            />
                                        </div>

                                        {/* ── Manual Test Selection ────────── */}
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                                    Manual Tests
                                                    <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] normal-case font-normal">
                                                        {selectedTestIds.size} selected
                                                    </span>
                                                </label>
                                            </div>

                                            {testCasesLoading ? (
                                                <div className="flex items-center gap-2 py-4 text-sm text-slate-500 dark:text-slate-400">
                                                    <Loader2 size={14} className="animate-spin" />
                                                    Loading test cases…
                                                </div>
                                            ) : testCases.length === 0 ? (
                                                <p className="text-sm text-slate-400 dark:text-slate-500 py-3">
                                                    No test cases found for this project. Create some in the Test Cases page first.
                                                </p>
                                            ) : (
                                                <div className="flex flex-col gap-2 max-h-80 overflow-y-auto rounded-lg border border-slate-200 dark:border-gh-border-dark">
                                                    {suiteNames.map((suiteName) => {
                                                        const cases = grouped[suiteName];
                                                        const isExpanded = isSuiteExpanded(suiteName);
                                                        const fullySelected = isSuiteFullySelected(suiteName);
                                                        const partiallySelected = isSuitePartiallySelected(suiteName);

                                                        return (
                                                            <div key={suiteName}>
                                                                {/* Suite header */}
                                                                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-gh-bg-subtle-dark border-b border-slate-200 dark:border-gh-border-dark">
                                                                    {/* Suite checkbox */}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleSuiteSelection(suiteName)}
                                                                        className="shrink-0 text-slate-400 dark:text-slate-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                                                                        aria-label={`Select all tests in ${suiteName}`}
                                                                    >
                                                                        {fullySelected ? (
                                                                            <CheckSquare size={16} className="text-violet-600 dark:text-violet-400" />
                                                                        ) : partiallySelected ? (
                                                                            <CheckSquare size={16} className="text-violet-400 dark:text-violet-500 opacity-60" />
                                                                        ) : (
                                                                            <Square size={16} />
                                                                        )}
                                                                    </button>

                                                                    {/* Expand / collapse */}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleSuiteExpanded(suiteName)}
                                                                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                                                    >
                                                                        {isExpanded ? (
                                                                            <ChevronDown size={14} className="shrink-0 text-slate-400 dark:text-slate-500" />
                                                                        ) : (
                                                                            <ChevronRight size={14} className="shrink-0 text-slate-400 dark:text-slate-500" />
                                                                        )}
                                                                        {isExpanded ? (
                                                                            <FolderOpen size={14} className="shrink-0 text-indigo-500 dark:text-indigo-400" />
                                                                        ) : (
                                                                            <FolderClosed size={14} className="shrink-0 text-indigo-500 dark:text-indigo-400" />
                                                                        )}
                                                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                                                                            {suiteName}
                                                                        </span>
                                                                        <span className="ml-auto shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
                                                                            {cases.length}
                                                                        </span>
                                                                    </button>
                                                                </div>

                                                                {/* Individual test cases */}
                                                                {isExpanded && (
                                                                    <div className="divide-y divide-slate-100 dark:divide-gh-border-dark">
                                                                        {cases.map((tc) => {
                                                                            const isSelected = selectedTestIds.has(tc._id);
                                                                            return (
                                                                                <label
                                                                                    key={tc._id}
                                                                                    className={`flex items-center gap-3 px-3 py-2 pl-9 cursor-pointer transition-colors ${isSelected
                                                                                            ? 'bg-violet-50 dark:bg-violet-950/20'
                                                                                            : 'hover:bg-slate-50 dark:hover:bg-gh-bg-subtle-dark'
                                                                                        }`}
                                                                                >
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => toggleTestCase(tc._id)}
                                                                                        className="shrink-0"
                                                                                    >
                                                                                        {isSelected ? (
                                                                                            <CheckSquare size={15} className="text-violet-600 dark:text-violet-400" />
                                                                                        ) : (
                                                                                            <Square size={15} className="text-slate-300 dark:text-slate-600" />
                                                                                        )}
                                                                                    </button>
                                                                                    <div className="min-w-0">
                                                                                        <p className="text-sm text-slate-800 dark:text-slate-200 truncate">
                                                                                            {tc.title}
                                                                                        </p>
                                                                                        {tc.description && (
                                                                                            <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                                                                                {tc.description}
                                                                                            </p>
                                                                                        )}
                                                                                    </div>
                                                                                    <span className="ml-auto shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
                                                                                        {tc.steps?.length ?? 0} steps
                                                                                    </span>
                                                                                </label>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {/* ── Automated Test Section ───────── */}
                                        <div className="rounded-xl border border-slate-200 dark:border-gh-border-dark overflow-hidden">
                                            <button
                                                type="button"
                                                onClick={() => setIncludeAutomated((v) => !v)}
                                                className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-gh-bg-subtle-dark hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors text-left"
                                            >
                                                <div className="flex items-center gap-2">
                                                    {includeAutomated ? (
                                                        <CheckSquare size={16} className="text-violet-600 dark:text-violet-400" />
                                                    ) : (
                                                        <Square size={16} className="text-slate-400 dark:text-slate-500" />
                                                    )}
                                                    <Sparkles size={14} className="text-sky-600 dark:text-sky-400" />
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                        Include Automated Test Run
                                                    </span>
                                                </div>
                                                {includeAutomated ? (
                                                    <ChevronDown size={14} className="text-slate-400 dark:text-slate-500" />
                                                ) : (
                                                    <ChevronRight size={14} className="text-slate-400 dark:text-slate-500" />
                                                )}
                                            </button>

                                            {includeAutomated && (
                                                <div className="px-4 py-3 border-t border-slate-200 dark:border-gh-border-dark flex flex-col gap-3">
                                                    {hasRunSettings ? (
                                                        <>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                Automated tests will run using your project&apos;s Docker image:{' '}
                                                                <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px]">
                                                                    {projectSettings?.image}
                                                                </code>
                                                            </p>
                                                            <div className="flex flex-col gap-1.5">
                                                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                                                    Test Folder / Path
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={automatedFolder}
                                                                    onChange={(e) => setAutomatedFolder(e.target.value)}
                                                                    placeholder="e.g. tests/api or all"
                                                                    className={INPUT_CLASS}
                                                                />
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                                                            <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                                            <span>
                                                                No Docker image configured. Go to <strong>Settings → Run Settings</strong> to configure your Docker image and target URL first.
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
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
                                            onClick={handleLaunch}
                                            disabled={isSaving || !cycleName.trim()}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors duration-150"
                                        >
                                            {isSaving ? (
                                                <>
                                                    <Loader2 size={14} className="animate-spin" />
                                                    Launching…
                                                </>
                                            ) : (
                                                <>
                                                    <Layers size={14} />
                                                    Launch Cycle
                                                </>
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
