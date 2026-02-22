/**
 * Test Cases Page (Sprint 9 — Quality Hub)
 *
 * Repository view for manual and automated test cases.
 * Features:
 *  - Browse, filter by project
 *  - Collapsible suite folders (accordion grouping by suite field)
 *  - Full CRUD: create, edit, delete test cases
 *  - AI-powered bulk suite generation via Gemini
 */

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import axios from 'axios';
import {
    ClipboardList, Plus, Loader2, AlertCircle, FlaskConical,
    Sparkles, Pencil, Trash2, X, CheckCircle2,
    FolderOpen, FolderClosed, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TestCaseDrawer, type ITestCaseInitialData } from '../components/TestCaseDrawer';

// ── Constants ─────────────────────────────────────────────────────────────────

const isProduction =
    window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_URL = isProduction ? import.meta.env.VITE_API_URL ?? '' : 'http://localhost:3000';

const UNCATEGORIZED_KEY = 'Uncategorized';

// ── Types ─────────────────────────────────────────────────────────────────────

interface IProject {
    id: string;
    name: string;
    slug: string;
}

interface ITestCaseRow {
    _id: string;
    title: string;
    description?: string;
    suite?: string;
    preconditions?: string;
    type: 'MANUAL' | 'AUTOMATED';
    steps?: Array<{ action: string; expectedResult: string }>;
    createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    } catch {
        return iso;
    }
}

/** Group test cases by their suite field. Tests without a suite go into "Uncategorized". */
function groupBySuite(testCases: ITestCaseRow[]): Record<string, ITestCaseRow[]> {
    return testCases.reduce<Record<string, ITestCaseRow[]>>((acc, tc) => {
        const key = tc.suite?.trim() || UNCATEGORIZED_KEY;
        if (!acc[key]) acc[key] = [];
        acc[key].push(tc);
        return acc;
    }, {});
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TestCases() {
    const { token } = useAuth();
    const queryClient = useQueryClient();
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');

    // ── Drawer state ────────────────────────────────────────────────────────
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingTestCase, setEditingTestCase] = useState<ITestCaseInitialData | null>(null);

    // ── Suite accordion state (all expanded by default) ─────────────────────
    const [expandedSuites, setExpandedSuites] = useState<Record<string, boolean>>({});

    // ── AI suite modal state ────────────────────────────────────────────────
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiFeature, setAiFeature] = useState('');
    const [isGeneratingSuite, setIsGeneratingSuite] = useState(false);
    const [aiSuiteError, setAiSuiteError] = useState<string | null>(null);

    // ── Success banner state ────────────────────────────────────────────────
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // ── Fetch projects ──────────────────────────────────────────────────────
    const {
        data: projectsData,
        isLoading: projectsLoading,
    } = useQuery<{ projects: IProject[] }>({
        queryKey: ['projects', token],
        queryFn: async () => {
            const { data } = await axios.get(`${API_URL}/api/projects`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            return data;
        },
        enabled: !!token,
        staleTime: 60_000,
    });

    const projects = projectsData?.projects ?? [];

    // Auto-select the first project when the list loads
    const effectiveProjectId =
        selectedProjectId || (projects.length > 0 ? projects[0].id : '');

    // ── Fetch test cases for the selected project ───────────────────────────
    const {
        data: testCasesData,
        isLoading: testCasesLoading,
        isError: testCasesError,
    } = useQuery<{ testCases: ITestCaseRow[] }>({
        queryKey: ['test-cases', effectiveProjectId, token],
        queryFn: async () => {
            const { data } = await axios.get(
                `${API_URL}/api/test-cases?projectId=${effectiveProjectId}`,
                { headers: { Authorization: `Bearer ${token}` } },
            );
            return data.data;
        },
        enabled: !!token && !!effectiveProjectId,
        staleTime: 30_000,
    });

    const testCases = testCasesData?.testCases ?? [];
    const grouped = useMemo(() => groupBySuite(testCases), [testCases]);
    const suiteNames = useMemo(() => {
        // Sort suite names alphabetically, but push "Uncategorized" to the end
        const keys = Object.keys(grouped);
        return keys.sort((a, b) => {
            if (a === UNCATEGORIZED_KEY) return 1;
            if (b === UNCATEGORIZED_KEY) return -1;
            return a.localeCompare(b);
        });
    }, [grouped]);

    // ── Accordion helpers ───────────────────────────────────────────────────

    /** A suite is expanded by default unless explicitly collapsed by the user. */
    function isSuiteExpanded(suiteName: string): boolean {
        return expandedSuites[suiteName] !== false;
    }

    function toggleSuite(suiteName: string) {
        setExpandedSuites((prev) => ({
            ...prev,
            [suiteName]: !isSuiteExpanded(suiteName),
        }));
    }

    // ── Handlers ────────────────────────────────────────────────────────────

    function handleOpenCreate() {
        setEditingTestCase(null);
        setIsDrawerOpen(true);
    }

    function handleOpenEdit(tc: ITestCaseRow) {
        setEditingTestCase({
            _id: tc._id,
            title: tc.title,
            description: tc.description,
            suite: tc.suite,
            preconditions: tc.preconditions,
            type: tc.type,
            steps: tc.steps,
        });
        setIsDrawerOpen(true);
    }

    async function handleDelete(id: string) {
        try {
            await axios.delete(`${API_URL}/api/test-cases/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            await queryClient.invalidateQueries({ queryKey: ['test-cases'] });
        } catch {
            // Silently fail — the UI will still show the row until next refetch
        }
    }

    function showSuccess(message: string) {
        setSuccessMessage(message);
        setTimeout(() => setSuccessMessage(null), 4000);
    }

    // ── AI suite generation handler ─────────────────────────────────────────

    async function handleGenerateSuite() {
        if (!aiFeature.trim()) return;
        setIsGeneratingSuite(true);
        setAiSuiteError(null);

        try {
            // Step 1: Generate test cases via AI
            const { data: genData } = await axios.post(
                `${API_URL}/api/ai/generate-test-suite`,
                { feature: aiFeature.trim() },
                { headers: { Authorization: `Bearer ${token}` } },
            );

            if (!genData.success || !Array.isArray(genData.data?.testCases)) {
                setAiSuiteError(genData.error ?? 'AI generation failed.');
                return;
            }

            const generatedCases = genData.data.testCases;

            // Step 2: Bulk insert all generated test cases in a single DB operation
            await axios.post(
                `${API_URL}/api/test-cases/bulk`,
                {
                    projectId: effectiveProjectId,
                    testCases: generatedCases,
                },
                { headers: { Authorization: `Bearer ${token}` } },
            );

            // Step 3: Refresh and close
            await queryClient.invalidateQueries({ queryKey: ['test-cases'] });
            setIsAiModalOpen(false);
            setAiFeature('');
            showSuccess(`Successfully generated ${generatedCases.length} test cases for "${aiFeature.trim()}"!`);
        } catch (err: unknown) {
            const message =
                axios.isAxiosError(err)
                    ? err.response?.data?.error ?? err.message
                    : 'Failed to generate test suite.';
            setAiSuiteError(message);
        } finally {
            setIsGeneratingSuite(false);
        }
    }

    // ── Render ─────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full gap-6 p-6 md:p-8">

            {/* ── Success banner ────────────────────────────────────────── */}
            {successMessage && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 text-sm animate-fade-in">
                    <CheckCircle2 size={16} className="shrink-0 text-green-600 dark:text-green-400" />
                    {successMessage}
                </div>
            )}

            {/* ── Page header ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/40 shrink-0">
                        <ClipboardList size={18} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                            Test Cases
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Manual and automated test case repository
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* AI Suite Generation button */}
                    <button
                        onClick={() => { setAiSuiteError(null); setIsAiModalOpen(true); }}
                        disabled={!effectiveProjectId}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors duration-150"
                    >
                        <Sparkles size={16} />
                        Generate Suite with AI
                    </button>

                    {/* Manual create button */}
                    <button
                        onClick={handleOpenCreate}
                        disabled={!effectiveProjectId}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors duration-150 shrink-0"
                    >
                        <Plus size={16} />
                        Create Manual Test
                    </button>
                </div>
            </div>

            {/* ── Project selector ────────────────────────────────────── */}
            <div className="flex items-center gap-3">
                <label
                    htmlFor="project-select"
                    className="text-sm font-medium text-slate-600 dark:text-slate-400 shrink-0"
                >
                    Project
                </label>

                {projectsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <Loader2 size={14} className="animate-spin" />
                        Loading projects…
                    </div>
                ) : projects.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        No projects found. Create a project in Settings first.
                    </p>
                ) : (
                    <select
                        id="project-select"
                        value={effectiveProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className="px-3 py-2 text-sm border border-slate-300 dark:border-gh-border-dark rounded-lg bg-white dark:bg-gh-bg-dark text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer"
                    >
                        {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* ── Test cases (accordion by suite) ─────────────────────── */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-3">

                {testCasesLoading ? (
                    <div className="flex items-center justify-center gap-2 h-48 text-slate-500 dark:text-slate-400">
                        <Loader2 size={18} className="animate-spin" />
                        <span className="text-sm">Loading test cases…</span>
                    </div>
                ) : testCasesError ? (
                    <div className="flex flex-col items-center justify-center gap-3 h-48 text-red-600 dark:text-red-400">
                        <AlertCircle size={24} />
                        <p className="text-sm">Failed to load test cases. Please try again.</p>
                    </div>
                ) : testCases.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 h-48 text-slate-400 dark:text-slate-500">
                        <FlaskConical size={32} strokeWidth={1.5} />
                        <p className="text-sm font-medium">No test cases yet</p>
                        <p className="text-xs text-center max-w-xs">
                            Click &quot;Create Manual Test&quot; or &quot;Generate Suite with AI&quot; to get started.
                        </p>
                    </div>
                ) : (
                    suiteNames.map((suiteName) => {
                        const cases = grouped[suiteName];
                        const isExpanded = isSuiteExpanded(suiteName);

                        return (
                            <div
                                key={suiteName}
                                className="rounded-xl border border-slate-200 dark:border-gh-border-dark bg-white dark:bg-gh-bg-dark overflow-hidden"
                            >
                                {/* ── Suite folder header ────────────── */}
                                <button
                                    type="button"
                                    onClick={() => toggleSuite(suiteName)}
                                    className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-gh-bg-subtle-dark hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors duration-100 cursor-pointer select-none"
                                >
                                    {/* Chevron */}
                                    {isExpanded ? (
                                        <ChevronDown size={16} className="shrink-0 text-slate-400 dark:text-slate-500" />
                                    ) : (
                                        <ChevronRight size={16} className="shrink-0 text-slate-400 dark:text-slate-500" />
                                    )}

                                    {/* Folder icon */}
                                    {isExpanded ? (
                                        <FolderOpen size={18} className="shrink-0 text-indigo-500 dark:text-indigo-400" />
                                    ) : (
                                        <FolderClosed size={18} className="shrink-0 text-indigo-500 dark:text-indigo-400" />
                                    )}

                                    {/* Suite name */}
                                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                                        {suiteName}
                                    </span>

                                    {/* Test count badge */}
                                    <span className="ml-auto shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                                        {cases.length} {cases.length === 1 ? 'test' : 'tests'}
                                    </span>
                                </button>

                                {/* ── Expanded table ─────────────────── */}
                                {isExpanded && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-t border-b border-slate-200 dark:border-gh-border-dark bg-slate-50/50 dark:bg-gh-bg-subtle-dark/50">
                                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                        Title
                                                    </th>
                                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                        Type
                                                    </th>
                                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                        Steps
                                                    </th>
                                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                        Created
                                                    </th>
                                                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                        Actions
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-gh-border-dark">
                                                {cases.map((tc) => (
                                                    <tr
                                                        key={tc._id}
                                                        className="hover:bg-slate-50 dark:hover:bg-gh-bg-subtle-dark transition-colors duration-100"
                                                    >
                                                        <td className="px-4 py-3">
                                                            <p className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-xs">
                                                                {tc.title}
                                                            </p>
                                                            {tc.description && (
                                                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs mt-0.5">
                                                                    {tc.description}
                                                                </p>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span
                                                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${tc.type === 'MANUAL'
                                                                        ? 'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800'
                                                                        : 'bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800'
                                                                    }`}
                                                            >
                                                                {tc.type}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                                            {tc.steps?.length ?? 0}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                                                            {formatDate(tc.createdAt)}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <button
                                                                    onClick={() => handleOpenEdit(tc)}
                                                                    aria-label={`Edit ${tc.title}`}
                                                                    className="flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-blue-600 dark:text-slate-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                                                                >
                                                                    <Pencil size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(tc._id)}
                                                                    aria-label={`Delete ${tc.title}`}
                                                                    className="flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* ── Creation / Edit drawer ────────────────────────────────── */}
            <TestCaseDrawer
                isOpen={isDrawerOpen}
                projectId={effectiveProjectId}
                onClose={() => { setIsDrawerOpen(false); setEditingTestCase(null); }}
                onSaved={() => queryClient.invalidateQueries({ queryKey: ['test-cases'] })}
                initialData={editingTestCase}
            />

            {/* ── AI Suite Generation Modal (Headless UI) ──────────────── */}
            <Transition show={isAiModalOpen}>
                <Dialog onClose={() => setIsAiModalOpen(false)} className="relative z-50">

                    {/* Backdrop */}
                    <TransitionChild
                        enter="transition-opacity duration-200 ease-out"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="transition-opacity duration-150 ease-in"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/70" aria-hidden="true" />
                    </TransitionChild>

                    {/* Modal panel */}
                    <div className="fixed inset-0 flex items-center justify-center p-4">
                        <TransitionChild
                            enter="transition-all duration-200 ease-out"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="transition-all duration-150 ease-in"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <DialogPanel className="w-full max-w-md rounded-2xl bg-white dark:bg-gh-bg-dark border border-slate-200 dark:border-gh-border-dark shadow-2xl">

                                {/* Header */}
                                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-gh-border-dark">
                                    <div className="flex items-center gap-2">
                                        <Sparkles size={18} className="text-violet-600 dark:text-violet-400" />
                                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                            Generate Test Suite with AI
                                        </h3>
                                    </div>
                                    <button
                                        onClick={() => setIsAiModalOpen(false)}
                                        aria-label="Close modal"
                                        className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                {/* Body */}
                                <div className="px-6 py-5 flex flex-col gap-4">
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                        Describe the feature or screen and Gemini will generate a complete test suite with multiple test cases and steps.
                                    </p>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                            Feature / Screen Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={aiFeature}
                                            onChange={(e) => setAiFeature(e.target.value)}
                                            placeholder="e.g. Login Screen, Checkout Process, User Profile"
                                            maxLength={200}
                                            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-gh-border-dark rounded-lg bg-white dark:bg-gh-bg-dark text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                                            autoFocus
                                        />
                                    </div>

                                    {aiSuiteError && (
                                        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-400">
                                            <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                            <span>{aiSuiteError}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-gh-border-dark">
                                    <button
                                        type="button"
                                        onClick={() => setIsAiModalOpen(false)}
                                        className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleGenerateSuite}
                                        disabled={isGeneratingSuite || !aiFeature.trim()}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors duration-150"
                                    >
                                        {isGeneratingSuite ? (
                                            <>
                                                <Loader2 size={14} className="animate-spin" />
                                                Generating…
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles size={14} />
                                                Generate Suite
                                            </>
                                        )}
                                    </button>
                                </div>

                            </DialogPanel>
                        </TransitionChild>
                    </div>

                </Dialog>
            </Transition>
        </div>
    );
}
