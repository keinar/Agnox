/**
 * StabilityPage — Feature B: Flakiness & Stability Detective
 *
 * Route: /stability
 * Sidebar entry: "Stability" (Activity icon) — visible only when aiFeatures.flakinessDetective is true.
 *
 * UI:
 *  - Group name selector (useGroupNames hook)
 *  - "Analyze Stability" button → POST /api/ai/analyze-stability
 *  - Results card: flakiness score gauge, verdict badge, findings list, recommendations
 *  - Previous Analyses section: history loaded from GET /api/ai/stability-reports
 *    Clicking a history row loads that report into the main card without a new LLM call.
 */

import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Activity, ChevronDown, Loader2, AlertCircle,
    CheckCircle2, TrendingUp, TrendingDown, Minus, Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGroupNames } from '../hooks/useGroupNames';

// ── Constants ──────────────────────────────────────────────────────────────────

const isProduction =
    window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_URL = isProduction
    ? (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? window.location.origin
    : 'http://localhost:3000';

// ── Types ──────────────────────────────────────────────────────────────────────

type Verdict = 'stable' | 'mostly_stable' | 'flaky' | 'highly_flaky';

interface IStabilityReport {
    groupName:          string;
    executionsAnalyzed: number;
    passRate:           number;
    flakinessScore:     number;
    verdict:            Verdict;
    findings:           string[];
    recommendations:    string[];
}

/** Persisted history record — extends the live report with DB identity fields. */
interface IHistoricalReport extends IStabilityReport {
    _id:       string;
    createdAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const VERDICT_CONFIG: Record<Verdict, {
    label: string;
    badgeClass: string;
    Icon: React.ElementType;
    gaugeClass: string;
}> = {
    stable: {
        label:      'Stable',
        badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
        gaugeClass: 'bg-emerald-500',
        Icon:       CheckCircle2,
    },
    mostly_stable: {
        label:      'Mostly Stable',
        badgeClass: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
        gaugeClass: 'bg-blue-500',
        Icon:       TrendingUp,
    },
    flaky: {
        label:      'Flaky',
        badgeClass: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
        gaugeClass: 'bg-yellow-500',
        Icon:       Minus,
    },
    highly_flaky: {
        label:      'Highly Flaky',
        badgeClass: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
        gaugeClass: 'bg-red-500',
        Icon:       TrendingDown,
    },
};

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        });
    } catch {
        return iso;
    }
}

async function fetchHistory(groupName: string, token: string): Promise<IHistoricalReport[]> {
    const { data } = await axios.get(`${API_URL}/api/ai/stability-reports`, {
        params:  { groupName },
        headers: { Authorization: `Bearer ${token}` },
    });
    return data.success ? (data.data.reports as IHistoricalReport[]) : [];
}

// ── Component ──────────────────────────────────────────────────────────────────

export function StabilityPage() {
    const { token } = useAuth();
    const groupNames = useGroupNames();

    const [selectedGroup, setSelectedGroup] = useState('');
    const [analyzing, setAnalyzing]         = useState(false);
    const [report, setReport]               = useState<IStabilityReport | null>(null);
    const [error, setError]                 = useState<string | null>(null);

    // History state
    const [history, setHistory]           = useState<IHistoricalReport[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [isHistoricalView, setIsHistoricalView] = useState(false);

    // Fetch history whenever the selected group changes
    useEffect(() => {
        if (!selectedGroup || !token) {
            setHistory([]);
            return;
        }

        let cancelled = false;
        setHistoryLoading(true);

        fetchHistory(selectedGroup, token)
            .then((records) => { if (!cancelled) setHistory(records); })
            .catch(() => { if (!cancelled) setHistory([]); })
            .finally(() => { if (!cancelled) setHistoryLoading(false); });

        return () => { cancelled = true; };
    }, [selectedGroup, token]);

    async function handleAnalyze() {
        if (!selectedGroup || analyzing) return;
        setError(null);
        setReport(null);
        setIsHistoricalView(false);
        setAnalyzing(true);

        try {
            const { data } = await axios.post(
                `${API_URL}/api/ai/analyze-stability`,
                { groupName: selectedGroup },
                { headers: { Authorization: `Bearer ${token}` } },
            );
            if (data.success) {
                setReport(data.data as IStabilityReport);
                // Refresh history so the new report appears immediately
                fetchHistory(selectedGroup, token!).then(setHistory).catch(() => {});
            } else {
                setError(data.error ?? 'Analysis failed. Please try again.');
            }
        } catch (err: any) {
            setError(err?.response?.data?.error ?? 'Failed to analyze stability.');
        } finally {
            setAnalyzing(false);
        }
    }

    function handleLoadHistoricalReport(item: IHistoricalReport) {
        setReport(item);
        setIsHistoricalView(true);
        setError(null);
    }

    const verdictCfg = report ? VERDICT_CONFIG[report.verdict] ?? VERDICT_CONFIG.flaky : null;

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

            {/* ── Page header ─────────────────────────────────────────── */}
            <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                    <Activity size={18} className="text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                    <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        Flakiness & Stability Detective
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        AI-powered analysis of test group stability and flakiness patterns.
                    </p>
                </div>
            </div>

            <div className="mt-8 rounded-xl border border-slate-200 dark:border-gh-border-dark bg-white dark:bg-gh-bg-dark p-6 space-y-5">

                {/* ── Group selector ──────────────────────────────────── */}
                <div>
                    <label
                        htmlFor="stability-group"
                        className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                    >
                        Select Test Group
                    </label>

                    {groupNames.length === 0 ? (
                        <p className="text-sm text-slate-400 dark:text-slate-500 italic">
                            No test groups found. Run some executions with a group name first.
                        </p>
                    ) : (
                        <div className="relative inline-block w-full max-w-sm">
                            <select
                                id="stability-group"
                                value={selectedGroup}
                                onChange={(e) => {
                                    setSelectedGroup(e.target.value);
                                    setReport(null);
                                    setError(null);
                                    setIsHistoricalView(false);
                                }}
                                className="w-full appearance-none px-4 py-2.5 pr-10 rounded-lg border border-slate-200 dark:border-gh-border-dark bg-white dark:bg-gh-bg-dark text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                            >
                                <option value="">— Select a group —</option>
                                {groupNames.map((g) => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                            <ChevronDown
                                size={16}
                                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                            />
                        </div>
                    )}
                </div>

                {/* ── Analyze button ──────────────────────────────────── */}
                <div>
                    <button
                        type="button"
                        onClick={handleAnalyze}
                        disabled={!selectedGroup || analyzing}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {analyzing ? (
                            <>
                                <Loader2 size={15} className="animate-spin" />
                                Analyzing…
                            </>
                        ) : (
                            <>
                                <Activity size={15} />
                                Analyze Stability
                            </>
                        )}
                    </button>
                </div>

                {/* ── Error state ─────────────────────────────────────── */}
                {error && (
                    <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                        <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

            </div>

            {/* ── Results card ────────────────────────────────────────── */}
            {report && verdictCfg && (
                <div className="mt-6 rounded-xl border border-slate-200 dark:border-gh-border-dark bg-white dark:bg-gh-bg-dark divide-y divide-slate-100 dark:divide-gh-border-dark overflow-hidden">

                    {/* Historical-view banner */}
                    {isHistoricalView && (
                        <div className="px-6 py-2.5 bg-amber-50 dark:bg-amber-950/20 flex items-center gap-2">
                            <Clock size={13} className="text-amber-500 flex-shrink-0" />
                            <span className="text-xs text-amber-700 dark:text-amber-400">
                                Viewing a historical report — click <strong>Analyze Stability</strong> to run a fresh analysis.
                            </span>
                        </div>
                    )}

                    {/* Summary header */}
                    <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">
                                Analysis for
                            </p>
                            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                                {report.groupName}
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Based on {report.executionsAnalyzed} executions · {report.passRate}% pass rate
                            </p>
                        </div>

                        {/* Verdict badge */}
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold border ${verdictCfg.badgeClass}`}>
                            <verdictCfg.Icon size={14} />
                            {verdictCfg.label}
                        </div>
                    </div>

                    {/* Flakiness score gauge */}
                    <div className="px-6 py-4">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                Flakiness Score
                            </span>
                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                {report.flakinessScore} / 100
                            </span>
                        </div>
                        <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            {/* dynamic width requires inline style — no equivalent static Tailwind class */}
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${verdictCfg.gaugeClass}`}
                                style={{ width: `${report.flakinessScore}%` }}
                            />
                        </div>
                        <div className="flex justify-between mt-1">
                            <span className="text-[10px] text-slate-400">0 — Stable</span>
                            <span className="text-[10px] text-slate-400">100 — Always Fails</span>
                        </div>
                    </div>

                    {/* Findings */}
                    {report.findings.length > 0 && (
                        <div className="px-6 py-4">
                            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">
                                Findings
                            </h3>
                            <ul className="space-y-2">
                                {report.findings.map((f, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 flex-shrink-0" />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Recommendations */}
                    {report.recommendations.length > 0 && (
                        <div className="px-6 py-4">
                            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">
                                Recommendations
                            </h3>
                            <ul className="space-y-2">
                                {report.recommendations.map((r, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                                        <span className="mt-1 text-violet-500 dark:text-violet-400 flex-shrink-0">→</span>
                                        {r}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                </div>
            )}

            {/* ── Previous Analyses ───────────────────────────────────── */}
            {selectedGroup && (
                <div className="mt-8">
                    <div className="flex items-center gap-2 mb-3">
                        <Clock size={14} className="text-slate-400 dark:text-slate-500" />
                        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Previous Analyses
                        </h2>
                        {historyLoading && <Loader2 size={12} className="animate-spin text-slate-400" />}
                    </div>

                    {!historyLoading && history.length === 0 && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                            No previous analyses for this group yet.
                        </p>
                    )}

                    {history.length > 0 && (
                        <div className="rounded-xl border border-slate-200 dark:border-gh-border-dark overflow-hidden">
                            {history.map((item) => {
                                const cfg = VERDICT_CONFIG[item.verdict] ?? VERDICT_CONFIG.flaky;
                                return (
                                    <button
                                        key={item._id}
                                        type="button"
                                        onClick={() => handleLoadHistoricalReport(item)}
                                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-gh-border-dark last:border-b-0 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Clock size={12} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
                                            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                                                {formatDate(item.createdAt)}
                                            </span>
                                            <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:block">
                                                {item.executionsAnalyzed} runs · {item.passRate}% pass
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                                {item.flakinessScore}/100
                                            </span>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.badgeClass}`}>
                                                <cfg.Icon size={11} />
                                                {cfg.label}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

        </div>
    );
}
