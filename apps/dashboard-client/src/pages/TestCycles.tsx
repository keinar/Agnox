/**
 * Test Cycles Page (Sprint 9 — Quality Hub)
 *
 * Repository view for hybrid test cycles — groups of manual + automated tests.
 * Features:
 *  - Project selector
 *  - Data table with expandable rows showing cycle items
 *  - AUTOMATED items: status badge + execution link
 *  - MANUAL items: status badge + "Play" button → ManualExecutionDrawer
 */

import { useState, Fragment } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Layers, Plus, Loader2, AlertCircle, FolderKanban,
    CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight,
    Play, Bot, ClipboardCheck, SkipForward, Eye, FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CycleBuilderDrawer } from '../components/CycleBuilderDrawer';
import { ManualExecutionDrawer } from '../components/ManualExecutionDrawer';
import { ExecutionDrawer } from '../components/ExecutionDrawer';
import type { Execution } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const isProduction =
    window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_URL = isProduction ? import.meta.env.VITE_API_URL ?? '' : 'http://localhost:3000';

// ── Types ─────────────────────────────────────────────────────────────────────

interface IProject {
    id: string;
    name: string;
    slug: string;
}

interface IManualStep {
    id: string;
    action: string;
    expectedResult: string;
    status: string;
    comment?: string;
}

interface ICycleItem {
    id: string;
    testCaseId: string;
    type: 'MANUAL' | 'AUTOMATED';
    title: string;
    status: string;
    executionId?: string;
    manualSteps?: IManualStep[];
}

interface ICycleRow {
    _id: string;
    name: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED';
    items: ICycleItem[];
    summary: {
        total: number;
        passed: number;
        failed: number;
        automationRate: number;
    };
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

const CYCLE_STATUS_STYLES: Record<string, string> = {
    PENDING: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    RUNNING: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    COMPLETED: 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
};

const CYCLE_STATUS_ICONS: Record<string, React.ReactNode> = {
    PENDING: <Clock size={12} />,
    RUNNING: <Loader2 size={12} className="animate-spin" />,
    COMPLETED: <CheckCircle2 size={12} />,
};

const ITEM_STATUS_STYLES: Record<string, string> = {
    PENDING: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
    RUNNING: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
    PASSED: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
    FAILED: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
    ERROR: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
    SKIPPED: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
};

const ITEM_STATUS_ICONS: Record<string, React.ReactNode> = {
    PENDING: <Clock size={11} />,
    RUNNING: <Loader2 size={11} className="animate-spin" />,
    PASSED: <CheckCircle2 size={11} />,
    FAILED: <XCircle size={11} />,
    ERROR: <AlertCircle size={11} />,
    SKIPPED: <SkipForward size={11} />,
};

// ── Component ─────────────────────────────────────────────────────────────────

export function TestCycles() {
    const { token } = useAuth();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [expandedCycleId, setExpandedCycleId] = useState<string | null>(null);

    // Manual player / review state
    const [manualDrawer, setManualDrawer] = useState<{
        isOpen: boolean;
        cycleId: string;
        itemId: string;
        itemTitle: string;
        itemStatus: string;
        steps: IManualStep[];
    }>({ isOpen: false, cycleId: '', itemId: '', itemTitle: '', itemStatus: 'PENDING', steps: [] });

    // Automated execution review state
    const [reviewExecutionId, setReviewExecutionId] = useState<string | null>(null);

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
    const effectiveProjectId =
        selectedProjectId || (projects.length > 0 ? projects[0].id : '');

    // ── Fetch test cycles ───────────────────────────────────────────────────
    const {
        data: cyclesData,
        isLoading: cyclesLoading,
        isError: cyclesError,
    } = useQuery<{ cycles: ICycleRow[] }>({
        queryKey: ['test-cycles', effectiveProjectId, token],
        queryFn: async () => {
            const { data } = await axios.get(
                `${API_URL}/api/test-cycles?projectId=${effectiveProjectId}`,
                { headers: { Authorization: `Bearer ${token}` } },
            );
            return data.data;
        },
        enabled: !!token && !!effectiveProjectId,
        staleTime: 30_000,
    });

    const cycles = cyclesData?.cycles ?? [];

    // ── Fetch execution for automated review drawer ─────────────────────────
    const { data: reviewExecutionResponse } = useQuery<{ execution: Execution } | null>({
        queryKey: ['execution-review', reviewExecutionId, token],
        queryFn: async () => {
            const { data } = await axios.get(
                `${API_URL}/api/executions/${reviewExecutionId}`,
                { headers: { Authorization: `Bearer ${token}` } },
            );
            return data.success ? data.data : null;
        },
        enabled: !!token && !!reviewExecutionId,
        staleTime: 30_000,
    });

    const reviewExecution: Execution | null = reviewExecutionResponse?.execution ?? null;

    // ── Handlers ────────────────────────────────────────────────────────────

    function toggleExpand(cycleId: string) {
        setExpandedCycleId((prev) => (prev === cycleId ? null : cycleId));
    }

    function openManualPlayer(cycle: ICycleRow, item: ICycleItem) {
        setManualDrawer({
            isOpen: true,
            cycleId: cycle._id,
            itemId: item.id,
            itemTitle: item.title,
            itemStatus: item.status,
            steps: (item.manualSteps ?? []).map((s) => ({
                id: s.id,
                action: s.action,
                expectedResult: s.expectedResult,
                status: s.status as 'PENDING' | 'PASSED' | 'FAILED' | 'SKIPPED',
                comment: s.comment,
            })),
        });
    }

    function openExecutionReview(executionId: string) {
        setReviewExecutionId(executionId);
    }

    // ── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full gap-6 p-6 md:p-8">

            {/* ── Page header ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-violet-50 dark:bg-violet-950/40 shrink-0">
                        <Layers size={18} className="text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                            Test Cycles
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Hybrid cycles grouping manual and automated tests
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => setIsDrawerOpen(true)}
                    disabled={!effectiveProjectId}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors duration-150 shrink-0"
                >
                    <Plus size={16} />
                    Create Cycle
                </button>
            </div>

            {/* ── Project selector ────────────────────────────────────── */}
            <div className="flex items-center gap-3">
                <label
                    htmlFor="cycle-project-select"
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
                        id="cycle-project-select"
                        value={effectiveProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className="px-3 py-2 text-sm border border-slate-300 dark:border-gh-border-dark rounded-lg bg-white dark:bg-gh-bg-dark text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 transition cursor-pointer"
                    >
                        {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* ── Cycles table ────────────────────────────────────────── */}
            <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-200 dark:border-gh-border-dark bg-white dark:bg-gh-bg-dark">

                {cyclesLoading ? (
                    <div className="flex items-center justify-center gap-2 h-48 text-slate-500 dark:text-slate-400">
                        <Loader2 size={18} className="animate-spin" />
                        <span className="text-sm">Loading test cycles…</span>
                    </div>
                ) : cyclesError ? (
                    <div className="flex flex-col items-center justify-center gap-3 h-48 text-red-600 dark:text-red-400">
                        <AlertCircle size={24} />
                        <p className="text-sm">Failed to load test cycles. Please try again.</p>
                    </div>
                ) : cycles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 h-48 text-slate-400 dark:text-slate-500">
                        <FolderKanban size={32} strokeWidth={1.5} />
                        <p className="text-sm font-medium">No test cycles yet</p>
                        <p className="text-xs text-center max-w-xs">
                            Click &quot;Create Cycle&quot; to build your first hybrid test cycle.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 z-10">
                                <tr className="border-b border-slate-200 dark:border-gh-border-dark bg-slate-50 dark:bg-gh-bg-subtle-dark">
                                    <th className="px-4 py-3 w-8" />
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Cycle Name
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Automation
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Pass / Fail
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Total
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Created
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Report
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-gh-border-dark">
                                {cycles.map((cycle) => {
                                    const isExpanded = expandedCycleId === cycle._id;
                                    return (
                                        <Fragment key={cycle._id}>
                                            {/* ── Cycle row ────────────────── */}
                                            <tr
                                                onClick={() => toggleExpand(cycle._id)}
                                                className="cursor-pointer hover:bg-slate-50 dark:hover:bg-gh-bg-subtle-dark transition-colors duration-100"
                                            >
                                                <td className="px-4 py-3">
                                                    {isExpanded
                                                        ? <ChevronDown size={14} className="text-slate-400" />
                                                        : <ChevronRight size={14} className="text-slate-400" />}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-xs">
                                                        {cycle.name}
                                                    </p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${CYCLE_STATUS_STYLES[cycle.status] ?? ''}`}>
                                                        {CYCLE_STATUS_ICONS[cycle.status]}
                                                        {cycle.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full bg-violet-500 dark:bg-violet-400 transition-all"
                                                                style={{ width: `${cycle.summary.automationRate}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                                                            {cycle.summary.automationRate}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                                            <CheckCircle2 size={12} />
                                                            {cycle.summary.passed}
                                                        </span>
                                                        <span className="text-slate-300 dark:text-slate-600">/</span>
                                                        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                                                            <XCircle size={12} />
                                                            {cycle.summary.failed}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                                    {cycle.summary.total}
                                                </td>
                                                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                                                    {formatDate(cycle.createdAt)}
                                                </td>
                                                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => navigate(`/test-cycles/${cycle._id}/report`)}
                                                        title="View cycle report"
                                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors"
                                                    >
                                                        <Eye size={11} />
                                                        View Report
                                                    </button>
                                                </td>
                                            </tr>

                                            {/* ── Expanded items ──────────── */}
                                            {isExpanded && cycle.items && cycle.items.length > 0 && (
                                                <tr>
                                                    <td colSpan={8} className="p-0">
                                                        <div className="bg-slate-50 dark:bg-gh-bg-subtle-dark border-t border-slate-200 dark:border-gh-border-dark">
                                                            <div className="px-6 py-2 border-b border-slate-200 dark:border-gh-border-dark">
                                                                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                                                    Cycle Items ({cycle.items.length})
                                                                </p>
                                                            </div>
                                                            <div className="divide-y divide-slate-200 dark:divide-gh-border-dark">
                                                                {cycle.items.map((item) => (
                                                                    <div
                                                                        key={item.id}
                                                                        className={`flex items-center gap-3 px-6 py-2.5 transition-colors duration-100 ${
                                                                            item.type === 'MANUAL'
                                                                                ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/40'
                                                                                : ''
                                                                        }`}
                                                                        {...(item.type === 'MANUAL' && {
                                                                            role: 'button' as const,
                                                                            tabIndex: 0,
                                                                            onClick: () => openManualPlayer(cycle, item),
                                                                            onKeyDown: (e: React.KeyboardEvent) => {
                                                                                if (e.key === 'Enter' || e.key === ' ') openManualPlayer(cycle, item);
                                                                            },
                                                                        })}
                                                                    >
                                                                        {/* Type icon */}
                                                                        <div className="shrink-0">
                                                                            {item.type === 'AUTOMATED' ? (
                                                                                <Bot size={14} className="text-sky-600 dark:text-sky-400" />
                                                                            ) : (
                                                                                <ClipboardCheck size={14} className="text-violet-600 dark:text-violet-400" />
                                                                            )}
                                                                        </div>

                                                                        {/* Title */}
                                                                        <p className="flex-1 min-w-0 text-sm text-slate-700 dark:text-slate-300 truncate">
                                                                            {item.title}
                                                                        </p>

                                                                        {/* Type badge */}
                                                                        <span className="shrink-0 text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase">
                                                                            {item.type}
                                                                        </span>

                                                                        {/* Status badge — clickable for AUTOMATED items with an execution */}
                                                                        {item.type === 'AUTOMATED' && item.executionId ? (
                                                                            <button
                                                                                title="Click to view execution logs"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    openExecutionReview(item.executionId!);
                                                                                }}
                                                                                className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium hover:opacity-75 transition-opacity ${ITEM_STATUS_STYLES[item.status] ?? ITEM_STATUS_STYLES.PENDING}`}
                                                                            >
                                                                                {ITEM_STATUS_ICONS[item.status] ?? ITEM_STATUS_ICONS.PENDING}
                                                                                {item.status}
                                                                            </button>
                                                                        ) : (
                                                                            <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${ITEM_STATUS_STYLES[item.status] ?? ITEM_STATUS_STYLES.PENDING}`}>
                                                                                {ITEM_STATUS_ICONS[item.status] ?? ITEM_STATUS_ICONS.PENDING}
                                                                                {item.status}
                                                                            </span>
                                                                        )}

                                                                        {/* MANUAL: Execute (pending/running) or Review (completed) */}
                                                                        {item.type === 'MANUAL' && (item.status === 'PENDING' || item.status === 'RUNNING') && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    openManualPlayer(cycle, item);
                                                                                }}
                                                                                className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                                                                            >
                                                                                <Play size={11} /> Execute
                                                                            </button>
                                                                        )}
                                                                        {item.type === 'MANUAL' && item.status !== 'PENDING' && item.status !== 'RUNNING' && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    openManualPlayer(cycle, item);
                                                                                }}
                                                                                className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                                                            >
                                                                                <Eye size={11} /> Review
                                                                            </button>
                                                                        )}

                                                                        {/* AUTOMATED: Logs button when execution exists */}
                                                                        {item.type === 'AUTOMATED' && item.executionId && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    openExecutionReview(item.executionId!);
                                                                                }}
                                                                                className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 hover:bg-sky-200 dark:hover:bg-sky-900/50 transition-colors"
                                                                            >
                                                                                <FileText size={11} /> Logs
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}

                                            {isExpanded && (!cycle.items || cycle.items.length === 0) && (
                                                <tr>
                                                    <td colSpan={8} className="px-6 py-4 text-center text-sm text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-gh-bg-subtle-dark">
                                                        No items in this cycle.
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Cycle Builder Drawer ──────────────────────────────────── */}
            <CycleBuilderDrawer
                isOpen={isDrawerOpen}
                projectId={effectiveProjectId}
                onClose={() => setIsDrawerOpen(false)}
                onCreated={() => queryClient.invalidateQueries({ queryKey: ['test-cycles'] })}
            />

            {/* ── Manual Execution / Review Drawer ─────────────────────── */}
            <ManualExecutionDrawer
                isOpen={manualDrawer.isOpen}
                cycleId={manualDrawer.cycleId}
                itemId={manualDrawer.itemId}
                itemTitle={manualDrawer.itemTitle}
                itemStatus={manualDrawer.itemStatus}
                initialSteps={manualDrawer.steps}
                onClose={() => setManualDrawer((prev) => ({ ...prev, isOpen: false }))}
            />

            {/* ── Automated Execution Review Drawer ────────────────────── */}
            <ExecutionDrawer
                executionId={reviewExecutionId}
                execution={reviewExecution}
                onClose={() => setReviewExecutionId(null)}
            />
        </div>
    );
}
