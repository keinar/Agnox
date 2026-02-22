import React from 'react';
import {
    Trash2, CheckCircle, XCircle,
    Clock, PlayCircle, FileText, BarChart2,
    Sparkles, Loader2, AlertTriangle,
    User2, Timer, Github, Gitlab, Settings2, Link2, Bug,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { formatDistanceToNow, differenceInSeconds } from 'date-fns';
import { CreateJiraTicketModal } from './CreateJiraTicketModal';

// ── Module-level constants ─────────────────────────────────────────────────────

const FINISHED_STATUSES = new Set(['PASSED', 'FAILED', 'UNSTABLE']);

const LOCAL_INDICATORS = ['localhost', '127.0.0.1', 'host.docker.internal'] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExecutionRowProps {
    execution: any;
    onDelete: (id: string) => void;
    onSelect: (taskId: string) => void;
    isSelected: boolean;
    visibleColumns: Set<string>;
    /** When true, plays the slide-down entry animation (used for grouped-view children). */
    animateIn?: boolean;
}

type TriggerType = 'Manual' | 'CRON' | 'GitHub' | 'GitLab' | 'Jenkins' | 'Webhook';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TRIGGER_CONFIG: Record<TriggerType, { icon: React.ElementType; className: string }> = {
    Manual:  { icon: User2,     className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700' },
    CRON:    { icon: Timer,     className: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
    GitHub:  { icon: Github,    className: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
    GitLab:  { icon: Gitlab,    className: 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800' },
    Jenkins: { icon: Settings2, className: 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800' },
    Webhook: { icon: Link2,     className: 'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800' },
};

/** Maps the raw `trigger` field from the API to a display-ready TriggerType. */
const resolveTrigger = (raw: string | undefined): TriggerType => {
    if (!raw) return 'Manual';
    switch (raw.toLowerCase()) {
        case 'cron':
        case 'scheduled': return 'CRON';
        case 'github':
        case 'ci':        return 'GitHub';
        case 'gitlab':    return 'GitLab';
        case 'jenkins':   return 'Jenkins';
        case 'webhook':   return 'Webhook';
        default:          return 'Manual';
    }
};

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

// ── ExecutionRow component ─────────────────────────────────────────────────────

export const ExecutionRow: React.FC<ExecutionRowProps> = React.memo(function ExecutionRow({
    execution, onDelete, onSelect, isSelected, visibleColumns, animateIn = false,
}) {
    const [showJiraModal, setShowJiraModal] = React.useState(false);
    const [, setSearchParams] = useSearchParams();

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

    const handleRowClick = () => {
        setSearchParams((prev) => {
            prev.set('drawerId', execution.taskId);
            return prev;
        });
    };

    const handleRowKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleRowClick();
        }
    };

    const badgeClass = STATUS_BADGE[execution.status] ?? DEFAULT_BADGE;
    const iconBtnBase = 'flex items-center justify-center w-8 h-8 rounded-lg border transition-colors cursor-pointer';

    const trigger = resolveTrigger(execution.trigger);
    const triggerCfg = TRIGGER_CONFIG[trigger];
    const TriggerIcon = triggerCfg.icon;

    return (
        <>
            <tr
                tabIndex={0}
                onClick={handleRowClick}
                onKeyDown={handleRowKeyDown}
                aria-label={`Open details for execution ${execution.taskId}`}
                className={`h-14 border-b border-slate-100 dark:border-gh-border-dark transition-colors duration-150 cursor-pointer hover:bg-slate-50 dark:hover:bg-gh-bg-subtle-dark ${
                    animateIn ? 'animate-slide-down' : ''
                } ${
                    isSelected
                        ? 'bg-blue-50/60 dark:bg-blue-950/30'
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

                            {/* AI Analysis button — opens drawer with AI tab pre-selected */}
                            {(execution.status === 'FAILED' || execution.status === 'UNSTABLE') && execution.analysis && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSearchParams((prev) => {
                                            prev.set('drawerId',   execution.taskId);
                                            prev.set('drawerTab', 'ai-analysis');
                                            return prev;
                                        });
                                    }}
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
                        </div>
                    </td>
                )}
            </tr>

            {showJiraModal && (
                <CreateJiraTicketModal
                    execution={execution}
                    onClose={() => setShowJiraModal(false)}
                />
            )}
        </>
    );
});
