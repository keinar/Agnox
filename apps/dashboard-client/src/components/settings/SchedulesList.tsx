import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2, Calendar, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface IScheduleRow {
    _id: string;
    name: string;
    cronExpression: string;
    environment: string;
    folder: string;
    isActive: boolean;
    createdAt: string;
}

interface ISchedulesResponse {
    success: boolean;
    data: {
        schedules: IScheduleRow[];
    };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const getApiUrl = () =>
    window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
        ? import.meta.env.VITE_API_URL ?? ''
        : 'http://localhost:3000';

const ENV_BADGE: Record<string, string> = {
    production:  'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
    staging:     'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    development: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function SchedulesList() {
    const { token, user } = useAuth();
    const queryClient = useQueryClient();
    const [deletingId, setDeletingId] = React.useState<string | null>(null);

    const isViewer = user?.role === 'viewer';

    const { data, isLoading, isError } = useQuery<ISchedulesResponse>({
        queryKey: ['schedules'],
        queryFn: async () => {
            const res = await fetch(`${getApiUrl()}/api/schedules`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to fetch schedules');
            return res.json() as Promise<ISchedulesResponse>;
        },
        staleTime: 30_000,
    });

    const schedules = data?.data?.schedules ?? [];

    async function handleDelete(id: string, name: string): Promise<void> {
        if (!window.confirm(`Delete schedule "${name}"? This action cannot be undone.`)) return;

        setDeletingId(id);
        try {
            const res = await fetch(`${getApiUrl()}/api/schedules/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error((json as any).error ?? 'Delete failed');
            }
            await queryClient.invalidateQueries({ queryKey: ['schedules'] });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to delete schedule';
            alert(message);
        } finally {
            setDeletingId(null);
        }
    }

    // ── Loading state ──────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="flex items-center gap-2 py-10 text-slate-400 dark:text-slate-500">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm">Loading schedules...</span>
            </div>
        );
    }

    // ── Error state ────────────────────────────────────────────────────────────
    if (isError) {
        return (
            <div className="flex items-center gap-2 py-10 text-red-600 dark:text-red-400">
                <AlertCircle size={18} />
                <span className="text-sm">Failed to load schedules. Please refresh and try again.</span>
            </div>
        );
    }

    return (
        <div className="max-w-4xl">
            {/* Section heading */}
            <div className="mb-6">
                <h2 className="text-base font-semibold text-slate-900 dark:text-gh-text-dark">CRON Schedules</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Recurring test executions scheduled from the Run Modal. Use "Schedule Run" when launching a test to create one.
                </p>
            </div>

            {schedules.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-gh-border-dark bg-slate-50 dark:bg-gh-bg-dark p-10 text-center">
                    <Calendar size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No schedules yet</p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                        Open the Run Modal and choose "Schedule Run" to create your first CRON schedule.
                    </p>
                </div>
            ) : (
                <div className="rounded-xl border border-slate-300 dark:border-gh-border-dark bg-white dark:bg-gh-bg-dark shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-gh-border-dark bg-slate-50 dark:bg-gh-bg-subtle-dark">
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                    Name
                                </th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                    CRON Expression
                                </th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                    Environment
                                </th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                    Folder
                                </th>
                                {!isViewer && (
                                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                        Actions
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-gh-border-dark">
                            {schedules.map((schedule) => (
                                <tr
                                    key={schedule._id}
                                    className="hover:bg-slate-50 dark:hover:bg-gh-bg-subtle-dark transition-colors"
                                >
                                    <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-gh-text-dark">
                                        {schedule.name}
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <code className="px-2 py-0.5 rounded bg-slate-100 dark:bg-gh-bg-subtle-dark text-slate-700 dark:text-slate-300 text-xs font-mono">
                                            {schedule.cronExpression}
                                        </code>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${ENV_BADGE[schedule.environment] ?? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                                            {schedule.environment.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 text-xs font-mono">
                                        {schedule.folder || 'all'}
                                    </td>
                                    {!isViewer && (
                                        <td className="px-5 py-3.5 text-right">
                                            <button
                                                onClick={() => handleDelete(schedule._id, schedule.name)}
                                                disabled={deletingId === schedule._id}
                                                aria-label={`Delete schedule "${schedule.name}"`}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                            >
                                                {deletingId === schedule._id
                                                    ? <Loader2 size={13} className="animate-spin" />
                                                    : <Trash2 size={13} />
                                                }
                                                Delete
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
