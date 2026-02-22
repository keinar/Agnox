/**
 * CycleReportPage — Standalone live HTML preview of a test cycle report.
 *
 * Route: /test-cycles/:id/report
 * Protected but rendered outside AppLayout (full-page dark aesthetic).
 *
 * Features:
 *  - Fetches cycle data from GET /api/test-cycles/:id
 *  - Displays stat cards, item list, and expandable manual steps
 *  - "Download PDF" button streams the PDF blob from /api/test-cycles/:id/report
 *  - Footer shows VersionDisplay
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    ArrowLeft, Download, Loader2, AlertCircle,
    CheckCircle2, XCircle, Clock, SkipForward, Bot,
    ClipboardCheck, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { VersionDisplay } from '../components/VersionDisplay';

// ── Constants ─────────────────────────────────────────────────────────────────

const isProduction =
    window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_URL = isProduction ? import.meta.env.VITE_API_URL ?? '' : 'http://localhost:3000';

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Style maps ────────────────────────────────────────────────────────────────

const CYCLE_STATUS_STYLES: Record<string, string> = {
    PENDING:   'bg-amber-900/30 text-amber-400 border border-amber-700',
    RUNNING:   'bg-blue-900/30 text-blue-400 border border-blue-700',
    COMPLETED: 'bg-green-900/30 text-green-400 border border-green-700',
};

const ITEM_STATUS_STYLES: Record<string, string> = {
    PENDING: 'bg-slate-700 text-slate-300',
    RUNNING: 'bg-blue-900/40 text-blue-400',
    PASSED:  'bg-green-900/40 text-green-400',
    FAILED:  'bg-red-900/40 text-red-400',
    ERROR:   'bg-red-900/40 text-red-400',
    SKIPPED: 'bg-amber-900/40 text-amber-400',
};

const ITEM_STATUS_ICONS: Record<string, React.ReactNode> = {
    PENDING: <Clock size={11} />,
    RUNNING: <Loader2 size={11} className="animate-spin" />,
    PASSED:  <CheckCircle2 size={11} />,
    FAILED:  <XCircle size={11} />,
    ERROR:   <AlertCircle size={11} />,
    SKIPPED: <SkipForward size={11} />,
};

const STEP_STATUS_STYLES: Record<string, string> = {
    PENDING: 'bg-slate-700 text-slate-300',
    PASSED:  'bg-green-900/40 text-green-400',
    FAILED:  'bg-red-900/40 text-red-400',
    SKIPPED: 'bg-amber-900/40 text-amber-400',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
        });
    } catch {
        return iso;
    }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
    return (
        <div className={`flex flex-col gap-1 rounded-xl border p-4 ${accent}`}>
            <span className="text-[11px] font-semibold uppercase tracking-widest opacity-70">{label}</span>
            <span className="text-2xl font-bold">{value}</span>
        </div>
    );
}

function ManualStepRow({ step }: { step: IManualStep }) {
    return (
        <div className="flex items-start gap-3 px-4 py-2 border-t border-[#21262d]">
            <span className={`mt-0.5 shrink-0 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${STEP_STATUS_STYLES[step.status] ?? 'bg-slate-700 text-slate-300'}`}>
                {ITEM_STATUS_ICONS[step.status]}
                {step.status}
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-300 leading-snug">{step.action}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Expected: {step.expectedResult}</p>
                {step.comment && (
                    <p className="text-[10px] text-slate-400 italic mt-0.5">"{step.comment}"</p>
                )}
            </div>
        </div>
    );
}

function CycleItemRow({ item }: { item: ICycleItem }) {
    const [expanded, setExpanded] = useState(false);
    const hasSteps = item.type === 'MANUAL' && Array.isArray(item.manualSteps) && item.manualSteps.length > 0;

    return (
        <div className="rounded-lg border border-[#21262d] bg-[#161b22] overflow-hidden">
            <div
                className={`flex items-center gap-3 px-4 py-2.5 ${hasSteps ? 'cursor-pointer hover:bg-[#1c2129] transition-colors' : ''}`}
                onClick={hasSteps ? () => setExpanded((v) => !v) : undefined}
                role={hasSteps ? 'button' : undefined}
                tabIndex={hasSteps ? 0 : undefined}
                onKeyDown={hasSteps ? (e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded((v) => !v); } : undefined}
            >
                {/* Expand toggle */}
                <span className="shrink-0 text-slate-500">
                    {hasSteps
                        ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)
                        : <span className="w-3.5 inline-block" />}
                </span>

                {/* Type icon */}
                <span className="shrink-0 text-slate-400">
                    {item.type === 'AUTOMATED' ? <Bot size={14} /> : <ClipboardCheck size={14} />}
                </span>

                {/* Title */}
                <span className="flex-1 text-sm text-slate-200 truncate">{item.title}</span>

                {/* Type badge */}
                <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-medium ${
                    item.type === 'AUTOMATED'
                        ? 'bg-violet-900/40 text-violet-400'
                        : 'bg-sky-900/40 text-sky-400'
                }`}>
                    {item.type}
                </span>

                {/* Status badge */}
                <span className={`shrink-0 flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium ${ITEM_STATUS_STYLES[item.status] ?? 'bg-slate-700 text-slate-300'}`}>
                    {ITEM_STATUS_ICONS[item.status]}
                    {item.status}
                </span>
            </div>

            {expanded && hasSteps && (
                <div className="bg-[#0d1117]">
                    {item.manualSteps!.map((step) => (
                        <ManualStepRow key={step.id} step={step} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function CycleReportPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { token } = useAuth();
    const [downloading, setDownloading] = useState(false);

    const { data, isLoading, isError, error } = useQuery<ICycleRow>({
        queryKey: ['cycle', id],
        queryFn: async () => {
            const res = await fetch(`${API_URL}/api/test-cycles/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.error ?? `Server returned ${res.status}`);
            }
            return json.data.cycle as ICycleRow;
        },
        enabled: Boolean(id && token),
        retry: 1,
    });

    async function downloadPdf() {
        if (downloading || !data) return;
        setDownloading(true);
        try {
            const res = await fetch(`${API_URL}/api/test-cycles/${id}/report`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`Server returned ${res.status}`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const safeName = data.name
                .replace(/[^\w\s-]/g, '')
                .trim()
                .replace(/\s+/g, '-')
                .toLowerCase()
                .slice(0, 80);
            a.href = url;
            a.download = `cycle-report-${safeName}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err: unknown) {
            // Error surfaced to user via future toast; silently ignore for now
        } finally {
            setDownloading(false);
        }
    }

    // ── Loading state ──────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                    <Loader2 size={32} className="animate-spin text-violet-400" />
                    <p className="text-sm">Loading report…</p>
                </div>
            </div>
        );
    }

    // ── Error state ────────────────────────────────────────────────────────────
    if (isError || !data) {
        const message = error instanceof Error ? error.message : 'Failed to load cycle';
        return (
            <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-6">
                <div className="flex flex-col items-center gap-3 text-center max-w-sm">
                    <AlertCircle size={32} className="text-red-400" />
                    <p className="text-sm text-red-400 font-medium">{message}</p>
                    <button
                        onClick={() => navigate('/test-cycles')}
                        className="mt-2 flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        <ArrowLeft size={13} />
                        Back to Test Cycles
                    </button>
                </div>
            </div>
        );
    }

    const cycle = data;
    const failed = cycle.summary.failed;
    const passed = cycle.summary.passed;
    const total  = cycle.summary.total;
    const automationRate = cycle.summary.automationRate ?? 0;

    // ── Full report layout ─────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#0d1117] text-slate-200">

            {/* ── Fixed top bar ─────────────────────────────────────────── */}
            <header className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 h-14 border-b border-[#21262d] bg-[#0d1117]/90 backdrop-blur-sm">
                <button
                    onClick={() => navigate('/test-cycles')}
                    className="shrink-0 flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                    aria-label="Back to Test Cycles"
                >
                    <ArrowLeft size={14} />
                    <span className="hidden sm:inline">Test Cycles</span>
                </button>

                <span className="text-[#21262d]">|</span>

                <h1 className="flex-1 text-sm font-semibold text-slate-100 truncate">{cycle.name}</h1>

                <button
                    onClick={downloadPdf}
                    disabled={downloading}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
                >
                    {downloading ? (
                        <><Loader2 size={13} className="animate-spin" /> Generating…</>
                    ) : (
                        <><Download size={13} /> Download PDF</>
                    )}
                </button>
            </header>

            {/* ── Page content ─────────────────────────────────────────── */}
            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

                {/* ── Header card ─────────────────────────────────────── */}
                <div className="rounded-xl border border-[#21262d] bg-[#161b22] p-5 flex flex-wrap items-center gap-4">
                    <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${CYCLE_STATUS_STYLES[cycle.status] ?? 'bg-slate-700 text-slate-300 border border-slate-600'}`}>
                        {cycle.status === 'COMPLETED' && <CheckCircle2 size={12} />}
                        {cycle.status === 'RUNNING'   && <Loader2 size={12} className="animate-spin" />}
                        {cycle.status === 'PENDING'   && <Clock size={12} />}
                        {cycle.status}
                    </span>
                    <span className="text-sm text-slate-400">{formatDate(cycle.createdAt)}</span>
                    <span className="text-xs font-mono text-slate-500 ml-auto">ID: {cycle._id}</span>
                </div>

                {/* ── Stat cards ─────────────────────────────────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard label="Total"      value={total}            accent="border-[#21262d] bg-[#161b22] text-slate-200" />
                    <StatCard label="Passed"     value={passed}           accent="border-green-800 bg-green-900/20 text-green-300" />
                    <StatCard label="Failed"     value={failed}           accent="border-red-800 bg-red-900/20 text-red-300" />
                    <StatCard label="Auto Rate"  value={`${automationRate}%`} accent="border-violet-800 bg-violet-900/20 text-violet-300" />
                </div>

                {/* ── Items list ─────────────────────────────────────────── */}
                <section>
                    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
                        Cycle Items ({cycle.items.length})
                    </h2>
                    {cycle.items.length === 0 ? (
                        <p className="text-sm text-slate-500 py-6 text-center">No items in this cycle.</p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {cycle.items.map((item) => (
                                <CycleItemRow key={item.id} item={item} />
                            ))}
                        </div>
                    )}
                </section>

            </main>

            {/* ── Footer ──────────────────────────────────────────────── */}
            <footer className="border-t border-[#21262d] py-4 px-4 sm:px-6 flex items-center justify-center gap-2 text-[11px] text-slate-500">
                <span>Generated by Agnostic Automation Center</span>
                <span className="text-[#21262d]">|</span>
                <VersionDisplay />
            </footer>

        </div>
    );
}
