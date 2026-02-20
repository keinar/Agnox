import { Activity, CheckCircle2, Timer } from 'lucide-react';
import type { Execution } from '../types';
import type { IAnalyticsKPIs } from '../hooks/useAnalyticsKPIs';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Format milliseconds into a human-readable duration string.
 * e.g. 4500 → "4.5s", 75000 → "1m 15s", 0 → "---"
 */
const formatAvgDuration = (ms: number): string => {
    if (!ms) return '---';
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60_000);
    const seconds = Math.round((ms % 60_000) / 1000);
    return `${minutes}m ${seconds}s`;
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
    executions: Execution[];
    kpis: IAnalyticsKPIs | null;
    kpisLoading: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const StatsGrid = ({ executions, kpis, kpisLoading }: Props) => {
    // Compute local fallbacks from the in-memory executions list so the cards
    // are never blank while the KPI fetch is in-flight.
    const localTotal = executions.length;
    const localPassed = executions.filter(e => e.status === 'PASSED').length;
    const localRate = localTotal > 0 ? Math.round((localPassed / localTotal) * 100) : 0;

    const totalRuns  = kpis?.totalRuns  ?? localTotal;
    const passRate   = kpis?.successRate ?? localRate;
    const avgDurMs   = kpis?.avgDurationMs ?? 0;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatCard
                icon={<Activity size={20} className="text-blue-500" />}
                title="Total Runs"
                value={totalRuns}
                loading={kpisLoading && kpis === null}
                subtitle={kpis ? `This month (${kpis.period})` : undefined}
            />
            <StatCard
                icon={<CheckCircle2 size={20} className="text-emerald-500" />}
                title="Pass Rate"
                value={`${passRate}%`}
                loading={kpisLoading && kpis === null}
                subtitle={kpis ? `${kpis.passedRuns} / ${kpis.finishedRuns} finished` : undefined}
            />
            <StatCard
                icon={<Timer size={20} className="text-violet-500" />}
                title="Avg. Duration"
                value={kpisLoading && kpis === null ? '---' : formatAvgDuration(avgDurMs)}
                loading={kpisLoading && kpis === null}
                subtitle={kpis && kpis.avgDurationMs > 0 ? 'Finished runs' : undefined}
            />
        </div>
    );
};

// ── StatCard ──────────────────────────────────────────────────────────────────

interface StatCardProps {
    icon: React.ReactNode;
    title: string;
    value: string | number;
    loading?: boolean;
    subtitle?: string;
}

const StatCard = ({ icon, title, value, loading = false, subtitle }: StatCardProps) => (
    <div className="bg-gh-bg rounded-xl shadow-sm border border-gh-border p-5 flex items-center gap-4 transition-shadow duration-200 hover:shadow-md">
        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gh-bg-subtle flex items-center justify-center">
            {icon}
        </div>
        <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</div>
            {loading ? (
                <div className="mt-1 h-7 w-16 bg-slate-200 rounded animate-pulse" />
            ) : (
                <div className="text-2xl font-bold text-gh-text leading-tight">{value}</div>
            )}
            {subtitle && !loading && (
                <div className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</div>
            )}
        </div>
    </div>
);
