import React from 'react';
import {
    Trash2, ChevronRight, CheckCircle, XCircle,
    Clock, PlayCircle, FileText, BarChart2, Laptop, Server,
    Turtle, Zap, Box, Sparkles, Loader2, AlertTriangle,
    User2, Timer, Github, Clipboard, Check, Bug,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow, differenceInSeconds } from 'date-fns';
import AIAnalysisView from './AIAnalysisView';
import { CreateJiraTicketModal } from './CreateJiraTicketModal';
import { useAuth } from '../context/AuthContext';

// ── Module-level constants ─────────────────────────────────────────────────────

const EXEC_ROW_API_URL =
    window.location.hostname.includes('.com')
        ? import.meta.env.VITE_API_URL
        : 'http://localhost:3000';

const FINISHED_STATUSES = new Set(['PASSED', 'FAILED', 'UNSTABLE']);

const LOCAL_INDICATORS = ['localhost', '127.0.0.1', 'host.docker.internal'] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExecutionRowProps {
    execution: any;
    isExpanded: boolean;
    onToggle: () => void;
    onDelete: (id: string) => void;
    onSelect: (taskId: string) => void;
    isSelected: boolean;
    visibleColumns: Set<string>;
    visibleColCount: number;
    /** When true, plays the slide-down entry animation (used for grouped-view children). */
    animateIn?: boolean;
}

type TriggerType = 'Manual' | 'CRON' | 'GitHub';

// ── Helpers ───────────────────────────────────────────────────────────────────

const stripAnsi = (str: string): string => str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');

const TRIGGER_CONFIG: Record<TriggerType, { icon: React.ElementType; className: string }> = {
    Manual: { icon: User2,  className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700' },
    CRON:   { icon: Timer,  className: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
    GitHub: { icon: Github, className: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
};

const TRIGGER_OPTIONS: TriggerType[] = ['Manual', 'CRON', 'GitHub'];

const getMockTrigger = (taskId: string): TriggerType =>
    TRIGGER_OPTIONS[taskId.charCodeAt(taskId.length - 1) % 3];

const formatDateSafe = (dateString: string | Date | undefined) => {
    if (!dateString) return '-';
    try { return new Date(dateString).toLocaleString(); } catch { return 'Invalid Date'; }
};

const formatTimeAgo = (dateString: string | Date | undefined) => {
    if (!dateString) return '';
    try { return formatDistanceToNow(new Date(dateString), { addSuffix: true }); } catch { return ''; }
};

const calculateDuration = (exec: any) => {
    if (exec.duration && exec.duration !== '-') return exec.duration;
    if (exec.startTime && exec.endTime) {
        try {
            const start = new Date(exec.startTime);
            const end = new Date(exec.endTime);
            const seconds = differenceInSeconds(end, start);
            if (seconds < 60) return `${seconds}s`;
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${minutes}m ${remainingSeconds}s`;
        } catch { return '-'; }
    }
    if ((exec.status === 'RUNNING' || exec.status === 'ANALYZING') && exec.startTime) {
        try { return formatDistanceToNow(new Date(exec.startTime)).replace('about ', ''); } catch { return 'Running...'; }
    }
    return '-';
};

// Status badge variant classes — PASSED=emerald, FAILED/ERROR=rose, RUNNING/PENDING/UNSTABLE=amber, ANALYZING=blue
const STATUS_BADGE: Record<string, string> = {
    PASSED:    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
    FAILED:    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800',
    ERROR:     'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800',
    RUNNING:   'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
    PENDING:   'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
    ANALYZING: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
    UNSTABLE:  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
};

const DEFAULT_BADGE = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700';

/** Returns the appropriate icon for a given execution status. Module-level for stable reference. */
function getStatusIcon(status: string) {
    switch (status) {
        case 'PASSED':    return <CheckCircle size={13} />;
        case 'FAILED':    return <XCircle size={13} />;
        case 'ERROR':     return <XCircle size={13} />;
        case 'UNSTABLE':  return <AlertTriangle size={13} />;
        case 'ANALYZING': return <Sparkles size={13} className="animate-pulse" />;
        case 'RUNNING':   return <PlayCircle size={13} className="animate-spin" style={{ animationDuration: '3s' }} />;
        case 'PENDING':   return <Clock size={13} className="animate-pulse" />;
        default:          return <Clock size={13} />;
    }
}

// ── PerformanceInsight sub-component ──────────────────────────────────────────

interface PerformanceInsightProps {
    metrics: any;
}

function PerformanceInsight({ metrics }: PerformanceInsightProps) {
    if (!metrics || metrics.status === 'NO_DATA') return null;
    const avg = (metrics.averageDuration / 1000).toFixed(1);

    if (metrics.isRegression) {
        return (
            <span title={`Slower than average (${avg}s)`} className="flex items-center text-amber-500 ml-1">
                <Turtle size={12} />
            </span>
        );
    }
    if (metrics.lastRunDuration < metrics.averageDuration * 0.8) {
        return (
            <span title={`Faster than average (${avg}s)`} className="flex items-center text-emerald-500 ml-1">
                <Zap size={12} />
            </span>
        );
    }
    return null;
}

// ── ExecutionRow component ─────────────────────────────────────────────────────

export const ExecutionRow: React.FC<ExecutionRowProps> = React.memo(function ExecutionRow({
    execution, isExpanded, onToggle, onDelete, onSelect, isSelected, visibleColumns, visibleColCount, animateIn = false,
}) {
    const [showAI, setShowAI] = React.useState(false);
    const [showJiraModal, setShowJiraModal] = React.useState(false);
    const [copied, setCopied] = React.useState(false);
    const { token } = useAuth();

    // ── Metrics — fetched once per finished execution via TanStack Query ───────
    const { data: metrics = null } = useQuery<any>({
        queryKey: ['metrics', execution.image, token],
        queryFn: async ({ signal }) => {
            const res = await fetch(
                `${EXEC_ROW_API_URL}/api/metrics/${encodeURIComponent(execution.image)}`,
                { headers: { Authorization: `Bearer ${token}` }, signal },
            );
            if (res.status === 429) throw Object.assign(new Error('rate-limited'), { status: 429 });
            if (!res.ok) return null;
            return res.json();
        },
        enabled: FINISHED_STATUSES.has(execution.status) && !!execution.image && !!token,
        staleTime: 5 * 60 * 1000,
        retry: 3,
        retryDelay: (attempt) => Math.min(10_000 * Math.pow(2, attempt), 60_000),
    });

    const getBaseUrl = () => {
        if (execution.reportsBaseUrl) return execution.reportsBaseUrl.replace(/\/$/, '');
        const envBaseUrl = import.meta.env.VITE_API_URL;
        if (envBaseUrl) return envBaseUrl.replace(/\/$/, '');
        return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3000' : `https://api.${window.location.hostname}`;
    };

    const baseUrl = getBaseUrl();
    const htmlReportUrl   = `${baseUrl}/${execution.taskId}/native-report/index.html`;
    const allureReportUrl = `${baseUrl}/${execution.taskId}/allure-report/index.html`;

    const isFinished = FINISHED_STATUSES.has(execution.status);

    // Permissive local-run detection — check every possible field that may carry a base URL.
    const isRunLocal = (() => {
        const candidates: (string | undefined)[] = [
            execution.environment,
            execution.config?.baseUrl,
            execution.baseUrl,
            execution.meta?.baseUrl,
        ];
        return candidates.some(
            (v) => v && LOCAL_INDICATORS.some((indicator) => v.includes(indicator)),
        );
    })();

    const isDashboardCloud = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    const areReportsInaccessible = isDashboardCloud && isRunLocal;

    let terminalContent = '';
    if (execution.error) {
        const errorMsg = typeof execution.error === 'object' ? JSON.stringify(execution.error, null, 2) : execution.error;
        terminalContent += `🛑 FAILURE DETAILS:\n${errorMsg}\n\n──────────────────────────────────────────\n\n`;
    }
    const logs = execution.output || execution.logs;
    if (logs && logs.length > 0) terminalContent += Array.isArray(logs) ? logs.join('\n') : logs;
    if (!terminalContent) terminalContent = 'Waiting for logs...';

    const handleCopyLogs = (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            navigator.clipboard.writeText(stripAnsi(terminalContent));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // clipboard unavailable (e.g. non-HTTPS); silently ignore
        }
    };

    const handleRowKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
        }
    };

    const badgeClass = STATUS_BADGE[execution.status] ?? DEFAULT_BADGE;
    const iconBtnBase = 'flex items-center justify-center w-8 h-8 rounded-lg border transition-colors cursor-pointer';

    const trigger = getMockTrigger(execution.taskId);
    const triggerCfg = TRIGGER_CONFIG[trigger];
    const TriggerIcon = triggerCfg.icon;

    return (
        <>
            <tr
                tabIndex={0}
                onClick={onToggle}
                onKeyDown={handleRowKeyDown}
                aria-expanded={isExpanded}
                className={`h-14 border-b border-slate-100 dark:border-gh-border-dark transition-colors duration-150 cursor-pointer hover:bg-slate-50 dark:hover:bg-gh-bg-subtle-dark ${
                    animateIn ? 'animate-slide-down' : ''
                } ${
                    isSelected
                        ? 'bg-blue-50/60 dark:bg-blue-950/30'
                        : isExpanded
                            ? 'bg-slate-50 dark:bg-gh-bg-subtle-dark'
                            : 'odd:bg-gh-bg dark:odd:bg-gh-bg-dark even:bg-gh-bg-subtle dark:even:bg-gh-bg-subtle-dark'
                }`}
            >
                {/* Checkbox — bulk selection; stopPropagation prevents row expand */}
                <td
                    className="px-3 py-4 w-10"
                    onClick={(e) => e.stopPropagation()}
                >
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onSelect(execution.taskId)}
                        aria-label={`Select run ${execution.taskId}`}
                        className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                    />
                </td>

                {/* Run ID — mandatory, always first */}
                <td className="px-4 py-4 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {execution.taskId}
                </td>

                {/* Status — mandatory */}
                <td className="px-4 py-4">
                    <span className={badgeClass}>
                        {getStatusIcon(execution.status)} {execution.status}
                    </span>
                </td>

                {/* Triggered By — optional mock */}
                {visibleColumns.has('triggeredBy') && (
                    <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold border ${triggerCfg.className}`}>
                            <TriggerIcon size={11} />
                            {trigger}
                        </span>
                    </td>
                )}

                {/* Source — optional */}
                {visibleColumns.has('source') && (
                    <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold w-fit border ${
                                isRunLocal
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                    : 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                            }`}>
                                {isRunLocal ? <Laptop size={11} /> : <Server size={11} />}
                                {isRunLocal ? 'LOCAL' : 'CLOUD'}
                                <PerformanceInsight metrics={metrics} />
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                <Box size={10} />
                                <span className="font-mono">{execution.image?.split('/').pop() || 'container'}</span>
                            </div>
                        </div>
                    </td>
                )}

                {/* Environment — optional */}
                {visibleColumns.has('environment') && (
                    <td className="px-4 py-4">
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 px-2 py-0.5 rounded text-xs font-medium">
                            {execution.config?.environment?.toUpperCase() || 'DEV'}
                        </span>
                    </td>
                )}

                {/* Start Time — optional */}
                {visibleColumns.has('startTime') && (
                    <td className="px-4 py-4">
                        <div className="flex flex-col text-sm tabular-nums">
                            <span className="text-slate-700 dark:text-slate-300 font-medium">{formatDateSafe(execution.startTime)}</span>
                            <span className="text-xs text-slate-400 dark:text-slate-500">{formatTimeAgo(execution.startTime)}</span>
                        </div>
                    </td>
                )}

                {/* Duration — optional */}
                {visibleColumns.has('duration') && (
                    <td className="px-4 py-4 text-sm font-medium tabular-nums text-slate-700 dark:text-slate-300">
                        {calculateDuration(execution)}
                    </td>
                )}

                {/* Actions — optional */}
                {visibleColumns.has('actions') && (
                    <td className="px-4 py-4">
                        <div className="flex items-center gap-2 justify-end">

                            {/* AI Analysis button */}
                            {(execution.status === 'FAILED' || execution.status === 'UNSTABLE') && execution.analysis && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setShowAI(true); }}
                                    title="View AI Root Cause Analysis"
                                    aria-label="View AI Root Cause Analysis"
                                    className={`${iconBtnBase} text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/50`}
                                >
                                    <Sparkles size={16} />
                                </button>
                            )}

                            {/* Create / View Jira Ticket button — FAILED/ERROR/UNSTABLE */}
                            {(execution.status === 'FAILED' || execution.status === 'ERROR' || execution.status === 'UNSTABLE') && (() => {
                                const hasTickets = (execution.jiraTickets?.length ?? 0) > 0;
                                return (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowJiraModal(true); }}
                                        title={hasTickets ? `${execution.jiraTickets.length} Jira ticket(s) linked — click to view or create another` : 'Create Jira Ticket'}
                                        aria-label={hasTickets ? 'View or create Jira ticket' : 'Create Jira Ticket'}
                                        className={`${iconBtnBase} ${
                                            hasTickets
                                                ? 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-900/60'
                                                : 'text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/50'
                                        }`}
                                    >
                                        <Bug size={16} />
                                    </button>
                                );
                            })()}

                            {/* Analyzing spinner */}
                            {execution.status === 'ANALYZING' && (
                                <div
                                    role="status"
                                    aria-label="AI Analysis in progress"
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                                >
                                    <Loader2 size={12} className="animate-spin" />
                                    <span>Analyzing...</span>
                                </div>
                            )}

                            {/* Report links */}
                            {isFinished && (
                                <>
                                    {areReportsInaccessible ? (
                                        <span
                                            title="Reports available locally"
                                            className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded cursor-help"
                                        >
                                            Local Reports
                                        </span>
                                    ) : (
                                        <>
                                            {execution.hasNativeReport === true && (
                                                <a
                                                    href={htmlReportUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    title="HTML Report"
                                                    aria-label="Open HTML Report"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className={`${iconBtnBase} text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/50`}
                                                >
                                                    <FileText size={16} />
                                                </a>
                                            )}
                                            {execution.hasAllureReport === true && (
                                                <a
                                                    href={allureReportUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    title="Allure Report"
                                                    aria-label="Open Allure Report"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className={`${iconBtnBase} text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/50`}
                                                >
                                                    <BarChart2 size={16} />
                                                </a>
                                            )}
                                        </>
                                    )}
                                </>
                            )}

                            {/* Delete */}
                            <button
                                title="Delete"
                                aria-label={`Delete run ${execution.taskId}`}
                                onClick={(e) => { e.stopPropagation(); onDelete(execution.taskId); }}
                                className={`${iconBtnBase} text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-950/50`}
                            >
                                <Trash2 size={16} />
                            </button>

                            {/* Expand chevron — rotates 90° when row is expanded */}
                            <ChevronRight
                                size={16}
                                className={`text-slate-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                            />
                        </div>
                    </td>
                )}
            </tr>

            {/* Expanded detail panel */}
            {isExpanded && (
                <tr className="bg-slate-50 dark:bg-gh-bg-subtle-dark">
                    <td colSpan={visibleColCount} className="px-4 py-5">
                        {/* Details grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Docker Image</span>
                                <span className="text-sm font-mono text-blue-600 dark:text-blue-400">{execution.image || 'N/A'}</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Command</span>
                                <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{execution.command || 'N/A'}</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Base URL</span>
                                <span className="text-sm text-slate-600 dark:text-slate-400">{execution.config?.baseUrl}</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Tests Path</span>
                                <span className="text-sm text-slate-600 dark:text-slate-400">{execution.tests?.join(', ') || 'All'}</span>
                            </div>
                            {metrics && (
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Avg. Duration</span>
                                    <span className={`text-sm font-bold ${metrics.isRegression ? 'text-amber-600' : 'text-emerald-600'}`}>
                                        {(metrics.averageDuration / 1000).toFixed(2)}s
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Terminal */}
                        <div className="rounded-xl overflow-hidden border border-slate-800 shadow-md">
                            <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 border-b border-slate-800">
                                <span className="w-3 h-3 rounded-full bg-rose-500" />
                                <span className="w-3 h-3 rounded-full bg-amber-400" />
                                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                                <span className="ml-3 text-xs text-slate-500 font-mono">console output</span>
                                <button
                                    onClick={handleCopyLogs}
                                    aria-label={copied ? 'Logs copied' : 'Copy logs to clipboard'}
                                    title={copied ? 'Copied!' : 'Copy logs'}
                                    className={`ml-auto flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
                                        copied
                                            ? 'text-emerald-400 hover:bg-slate-700'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                                    }`}
                                >
                                    {copied ? <Check size={12} /> : <Clipboard size={12} />}
                                    {copied ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                            <pre className="bg-slate-950 text-slate-300 text-xs font-mono p-4 overflow-x-auto overflow-y-auto max-h-80 leading-relaxed whitespace-pre-wrap overscroll-contain">
                                {terminalContent}
                            </pre>
                        </div>
                    </td>
                </tr>
            )}

            <AIAnalysisView
                analysis={execution.analysis}
                status={execution.status}
                isVisible={showAI}
                onClose={() => setShowAI(false)}
            />

            {showJiraModal && (
                <CreateJiraTicketModal
                    execution={execution}
                    onClose={() => setShowJiraModal(false)}
                />
            )}
        </>
    );
});
