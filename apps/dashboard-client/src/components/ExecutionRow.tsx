import React from 'react';
import {
    Trash2, ChevronDown, ChevronRight, CheckCircle, XCircle,
    Clock, PlayCircle, FileText, BarChart2, Laptop, Server,
    Turtle, Zap, Box, Sparkles, Loader2, AlertTriangle,
    User2, Timer, Github, Clipboard, Check, Bug,
} from 'lucide-react';
import { formatDistanceToNow, differenceInSeconds } from 'date-fns';
import AIAnalysisView from './AIAnalysisView';
import { CreateJiraTicketModal } from './CreateJiraTicketModal';
import { useAuth } from '../context/AuthContext';

interface ExecutionRowProps {
    execution: any;
    isExpanded: boolean;
    onToggle: () => void;
    onDelete: (id: string) => void;
    visibleColumns: Set<string>;
    visibleColCount: number;
}

const stripAnsi = (str: string): string => str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');

type TriggerType = 'Manual' | 'CRON' | 'GitHub';

const TRIGGER_CONFIG: Record<TriggerType, { icon: React.ElementType; className: string }> = {
    Manual: { icon: User2,  className: 'bg-slate-100 text-slate-600 border-slate-200' },
    CRON:   { icon: Timer,  className: 'bg-amber-50 text-amber-700 border-amber-200' },
    GitHub: { icon: Github, className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
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

// Status badge variant classes — PASSED=emerald, FAILED/ERROR=rose, RUNNING/PENDING/UNSTABLE=amber, ANALYZING=purple
const STATUS_BADGE: Record<string, string> = {
    PASSED:    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200',
    FAILED:    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200',
    ERROR:     'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200',
    RUNNING:   'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200',
    PENDING:   'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200',
    ANALYZING: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200',
    UNSTABLE:  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200',
};

const DEFAULT_BADGE = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200';

export const ExecutionRow: React.FC<ExecutionRowProps> = React.memo(function ExecutionRow({
    execution, isExpanded, onToggle, onDelete, visibleColumns, visibleColCount,
}) {
    const [metrics, setMetrics] = React.useState<any>(null);
    const [showAI, setShowAI] = React.useState(false);
    const [showJiraModal, setShowJiraModal] = React.useState(false);
    const [copied, setCopied] = React.useState(false);
    const { token } = useAuth();

    React.useEffect(() => {
        const isFinished = ['PASSED', 'FAILED', 'UNSTABLE'].includes(execution.status);
        if (!isFinished || !execution.image || !token) return;

        const isProd = window.location.hostname.includes('.com');
        const API_URL = isProd ? import.meta.env.VITE_API_URL : 'http://localhost:3000';

        let cancelled = false;
        let timeoutId: ReturnType<typeof setTimeout>;
        let retries = 0;
        const MAX_RETRIES = 3;

        const fetchMetrics = (delay: number) => {
            timeoutId = setTimeout(async () => {
                if (cancelled) return;
                try {
                    const res = await fetch(`${API_URL}/api/metrics/${encodeURIComponent(execution.image)}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });

                    if (res.status === 429) {
                        retries++;
                        if (retries <= MAX_RETRIES) {
                            const backoff = Math.min(10000 * Math.pow(2, retries - 1), 60000);
                            fetchMetrics(backoff);
                        }
                        return;
                    }

                    if (res.ok && !cancelled) {
                        const data = await res.json();
                        setMetrics(data);
                    }
                } catch {
                    // metrics are non-critical; suppress
                }
            }, delay);
        };

        fetchMetrics(500);

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [execution.status, execution.image, token]);

    const renderPerformanceInsight = () => {
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
    };

    const getStatusIcon = (status: string) => {
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
    };

    const getBaseUrl = () => {
        if (execution.reportsBaseUrl) return execution.reportsBaseUrl.replace(/\/$/, '');
        const envBaseUrl = import.meta.env.VITE_API_URL;
        if (envBaseUrl) return envBaseUrl.replace(/\/$/, '');
        return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3000' : `https://api.${window.location.hostname}`;
    };

    const baseUrl = getBaseUrl();
    const htmlReportUrl  = `${baseUrl}/${execution.taskId}/native-report/index.html`;
    const allureReportUrl = `${baseUrl}/${execution.taskId}/allure-report/index.html`;

    const isFinished = ['PASSED', 'FAILED', 'UNSTABLE'].includes(execution.status);
    const isRunLocal = execution.reportsBaseUrl?.includes('localhost') || execution.reportsBaseUrl?.includes('127.0.0.1');
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

    const badgeClass = STATUS_BADGE[execution.status] ?? DEFAULT_BADGE;
    const iconBtnBase = 'flex items-center justify-center w-8 h-8 rounded-lg border transition-colors cursor-pointer';

    const trigger = getMockTrigger(execution.taskId);
    const triggerCfg = TRIGGER_CONFIG[trigger];
    const TriggerIcon = triggerCfg.icon;

    return (
        <>
            <tr
                onClick={onToggle}
                className={`border-b border-slate-100 transition-colors cursor-pointer hover:bg-slate-50 ${isExpanded ? 'bg-slate-50' : 'bg-white'}`}
            >
                {/* Run ID — mandatory, always first */}
                <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                    {execution.taskId}
                </td>

                {/* Status — mandatory */}
                <td className="px-4 py-3">
                    <span className={badgeClass}>
                        {getStatusIcon(execution.status)} {execution.status}
                    </span>
                </td>

                {/* Triggered By — optional mock */}
                {visibleColumns.has('triggeredBy') && (
                    <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold border ${triggerCfg.className}`}>
                            <TriggerIcon size={11} />
                            {trigger}
                        </span>
                    </td>
                )}

                {/* Source — optional */}
                {visibleColumns.has('source') && (
                    <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold w-fit border ${
                                isRunLocal
                                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                                    : 'bg-purple-50 text-purple-700 border-purple-200'
                            }`}>
                                {isRunLocal ? <Laptop size={11} /> : <Server size={11} />}
                                {isRunLocal ? 'LOCAL' : 'CLOUD'}
                                {renderPerformanceInsight()}
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
                    <td className="px-4 py-3">
                        <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded text-xs font-medium">
                            {execution.config?.environment?.toUpperCase() || 'DEV'}
                        </span>
                    </td>
                )}

                {/* Start Time — optional */}
                {visibleColumns.has('startTime') && (
                    <td className="px-4 py-3">
                        <div className="flex flex-col text-sm">
                            <span className="text-slate-700">{formatDateSafe(execution.startTime)}</span>
                            <span className="text-xs text-slate-400">{formatTimeAgo(execution.startTime)}</span>
                        </div>
                    </td>
                )}

                {/* Duration — optional */}
                {visibleColumns.has('duration') && (
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">
                        {calculateDuration(execution)}
                    </td>
                )}

                {/* Actions — optional */}
                {visibleColumns.has('actions') && (
                    <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">

                            {/* AI Analysis button */}
                            {(execution.status === 'FAILED' || execution.status === 'UNSTABLE') && execution.analysis && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setShowAI(true); }}
                                    title="View AI Root Cause Analysis"
                                    className={`${iconBtnBase} text-purple-500 bg-purple-50 border-purple-200 hover:bg-purple-100`}
                                >
                                    <Sparkles size={16} />
                                </button>
                            )}

                            {/* Create Jira Ticket button — FAILED/ERROR only */}
                            {(execution.status === 'FAILED' || execution.status === 'ERROR') && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setShowJiraModal(true); }}
                                    title="Create Jira Ticket"
                                    className={`${iconBtnBase} text-blue-500 bg-blue-50 border-blue-200 hover:bg-blue-100`}
                                >
                                    <Bug size={16} />
                                </button>
                            )}

                            {/* Analyzing spinner */}
                            {execution.status === 'ANALYZING' && (
                                <div
                                    title="AI Analysis in progress..."
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-600 border border-purple-200"
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
                                            className="text-[10px] text-slate-400 bg-slate-100 px-2 py-1 rounded cursor-help"
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
                                                    onClick={(e) => e.stopPropagation()}
                                                    className={`${iconBtnBase} text-blue-500 bg-blue-50 border-blue-200 hover:bg-blue-100`}
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
                                                    onClick={(e) => e.stopPropagation()}
                                                    className={`${iconBtnBase} text-emerald-500 bg-emerald-50 border-emerald-200 hover:bg-emerald-100`}
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
                                onClick={(e) => { e.stopPropagation(); onDelete(execution.taskId); }}
                                className={`${iconBtnBase} text-rose-500 bg-rose-50 border-rose-200 hover:bg-rose-100`}
                            >
                                <Trash2 size={16} />
                            </button>

                            {/* Expand chevron */}
                            {isExpanded
                                ? <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />
                                : <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />
                            }
                        </div>
                    </td>
                )}
            </tr>

            {/* Expanded detail panel */}
            {isExpanded && (
                <tr className="bg-slate-50">
                    <td colSpan={visibleColCount} className="px-4 py-5">
                        {/* Details grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Docker Image</span>
                                <span className="text-sm font-mono text-indigo-600">{execution.image || 'N/A'}</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Command</span>
                                <span className="text-xs font-mono text-slate-600">{execution.command || 'N/A'}</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Base URL</span>
                                <span className="text-sm text-slate-600">{execution.config?.baseUrl}</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Tests Path</span>
                                <span className="text-sm text-slate-600">{execution.tests?.join(', ') || 'All'}</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Run Origin</span>
                                <span className="text-sm text-slate-600">{execution.reportsBaseUrl || 'Unknown'}</span>
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
                            <pre className="bg-slate-950 text-slate-300 text-xs font-mono p-4 overflow-x-auto max-h-80 leading-relaxed whitespace-pre-wrap">
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
