import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import type { Execution } from '../types';

const isProduction =
    window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_URL = isProduction ? import.meta.env.VITE_API_URL : 'http://localhost:3000';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IExecutionFilters {
    /** Execution statuses to include. Empty array = all statuses. */
    status?: string[];
    /** Case-insensitive match on config.environment. Empty string = all. */
    environment?: string;
    /** ISO date string — include executions starting on or after this date. */
    startAfter?: string;
    /** ISO date string — include executions starting on or before this date (inclusive). */
    startBefore?: string;
    /** Exact match on groupName field. Empty string = no filter. */
    groupName?: string;
    /** Records per page. Default 25, max 100. */
    limit?: number;
    /** Zero-based offset into the result set. */
    offset?: number;
}

export interface IExecutionPage {
    executions: Execution[];
    total: number;
    limit: number;
    offset: number;
}

// ── URL builder ───────────────────────────────────────────────────────────────

function buildExecutionsUrl(filters: IExecutionFilters): string {
    const params = new URLSearchParams();
    params.set('limit',  String(filters.limit  ?? 25));
    params.set('offset', String(filters.offset ?? 0));
    if (filters.status?.length)  params.set('status',      filters.status.join(','));
    if (filters.environment)     params.set('environment',  filters.environment);
    if (filters.startAfter)      params.set('startAfter',   filters.startAfter);
    if (filters.startBefore)     params.set('startBefore',  filters.startBefore);
    if (filters.groupName)       params.set('groupName',    filters.groupName);
    return `${API_URL}/api/executions?${params.toString()}`;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useExecutions = (filters: IExecutionFilters = {}) => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    // Derive a stable query key from the current filter values.
    // React Query performs deep equality on array keys, so this re-fetches
    // only when filter values actually change, not on every render.
    const queryKey = ['executions', token, filters] as const;

    // Keep a synchronously-updated ref so socket handlers always access the
    // latest query key without needing to re-subscribe to the socket.
    const queryKeyRef = useRef(queryKey);
    queryKeyRef.current = queryKey;

    // ── Data fetching ─────────────────────────────────────────────────────────
    const { data: page, isLoading: loading, error } = useQuery<IExecutionPage>({
        queryKey,
        queryFn: async () => {
            const { data } = await axios.get(buildExecutionsUrl(filters), {
                headers: { Authorization: `Bearer ${token}` },
            });

            // New paginated envelope: { executions, total, limit, offset }
            if (data.success && data.data && !Array.isArray(data.data)) {
                return data.data as IExecutionPage;
            }

            // Backward-compatible fallback for a flat array response
            const arr: Execution[] = Array.isArray(data.data)
                ? data.data
                : Array.isArray(data)
                    ? data
                    : [];
            return { executions: arr, total: arr.length, limit: arr.length, offset: 0 };
        },
        enabled: !!token,
        staleTime: 0, // Always re-validate; real-time freshness via Socket.io
    });

    // ── Socket.io real-time updates ───────────────────────────────────────────
    useEffect(() => {
        if (!token) return;

        const socket = io(API_URL, {
            auth: { token },
            transports: ['websocket'],
        });

        socket.on('execution-updated', (updatedTask: Partial<Execution>) => {
            const current = queryClient.getQueryData<IExecutionPage>(queryKeyRef.current);
            const idx = current?.executions.findIndex(
                (ex) => ex.taskId === updatedTask.taskId,
            ) ?? -1;

            if (idx !== -1) {
                // Execution is on the current page — update in place.
                queryClient.setQueryData(
                    queryKeyRef.current,
                    (old: IExecutionPage | undefined) => {
                        if (!old) return old;
                        const next = [...old.executions];
                        next[idx] = { ...next[idx], ...updatedTask };
                        return { ...old, executions: next };
                    },
                );
            } else {
                // New or off-page execution — invalidate so the next page fetch
                // reflects the true state without a stale cache entry.
                queryClient.invalidateQueries({ queryKey: queryKeyRef.current });
            }
        });

        socket.on('execution-log', ({ taskId, log }: { taskId: string; log: string }) => {
            queryClient.setQueryData(
                queryKeyRef.current,
                (old: IExecutionPage | undefined) => {
                    if (!old) return old;
                    return {
                        ...old,
                        executions: old.executions.map((exec) =>
                            exec.taskId === taskId
                                ? { ...exec, output: (exec.output ?? '') + log }
                                : exec,
                        ),
                    };
                },
            );
        });

        return () => { socket.disconnect(); };
    }, [queryClient, token]);

    // ── Optimistic update helper ──────────────────────────────────────────────
    // Used by the delete handler in Dashboard.tsx. Operates on the executions
    // array inside the page cache and adjusts the total count accordingly.
    const setExecutions = useCallback(
        (updater: (old: Execution[]) => Execution[]) => {
            queryClient.setQueryData(
                queryKeyRef.current,
                (old: IExecutionPage | undefined) => {
                    if (!old) return old;
                    const next = updater(old.executions);
                    const removed = old.executions.length - next.length;
                    return {
                        ...old,
                        executions: next,
                        total: Math.max(0, old.total - removed),
                    };
                },
            );
        },
        [queryClient],
    );

    const errorMessage =
        error instanceof Error ? error.message : error ? String(error) : null;

    return {
        executions: page?.executions ?? [],
        total:      page?.total      ?? 0,
        limit:      page?.limit      ?? (filters.limit  ?? 25),
        offset:     page?.offset     ?? (filters.offset ?? 0),
        loading,
        error: errorMessage,
        setExecutions,
    };
};
