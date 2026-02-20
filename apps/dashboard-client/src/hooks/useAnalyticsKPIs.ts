import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const isProduction =
    window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_URL = isProduction ? import.meta.env.VITE_API_URL : 'http://localhost:3000';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IAnalyticsKPIs {
    totalRuns: number;
    passedRuns: number;
    finishedRuns: number;
    /** Pass rate over finished runs, 0–100 with 1 decimal precision. */
    successRate: number;
    /** Average execution duration in milliseconds. */
    avgDurationMs: number;
    /** ISO calendar month, e.g. "2026-02". */
    period: string;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Fetches live KPI metrics from the analytics endpoint.
 * Data is considered fresh for 60 seconds, then re-fetched in the background.
 */
export function useAnalyticsKPIs() {
    const { token } = useAuth();

    const { data: kpis = null, isLoading, isError } = useQuery<IAnalyticsKPIs | null>({
        queryKey: ['analytics-kpis', token],
        queryFn: async () => {
            const res = await axios.get<{ success: boolean; data?: IAnalyticsKPIs }>(
                `${API_URL}/api/analytics/kpis`,
                { headers: { Authorization: `Bearer ${token}` } },
            );

            if (res.data.success && res.data.data) {
                return res.data.data;
            }
            return null;
        },
        enabled: !!token,
        staleTime: 60_000,   // Re-fetch in background after 60 s
        retry: 2,
    });

    return { kpis, isLoading, isError };
}
