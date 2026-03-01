import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import type { IExecutionGroupPage, IExecutionGroup, Execution } from '../types';
import type { IExecutionFilters } from './useExecutions';

const isProduction =
    window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_URL = isProduction ? import.meta.env.VITE_API_URL : 'http://localhost:3000';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IGroupedFilters {
    /** Execution statuses to include. Empty array = all statuses. */
    status?: string[];
    /** Case-insensitive match on config.environment. */
    environment?: string;
    /** ISO date string — include executions starting on or after this date. */
    startAfter?: string;
    /** ISO date string — include executions starting on or before this date (inclusive). */
    startBefore?: string;
    /** Exact match on groupName — filters to show only this group. Empty string = all groups. */
    groupName?: string;
    /** Filter by execution source. Empty string = all. */
    source?: 'agnox-hosted' | 'external-ci' | '';
    /** Number of groups per page. Default 10, max 50. */
    limit?: number;
    /** Zero-based group offset. */
    offset?: number;
    /** Set to false to skip fetching (e.g. when grouped view is not active). */
    enabled?: boolean;
}

// ── URL builder ───────────────────────────────────────────────────────────────

function buildGroupedUrl(filters: IGroupedFilters): string {
    const params = new URLSearchParams();
    params.set('limit',  String(filters.limit  ?? 10));
    params.set('offset', String(filters.offset ?? 0));
    if (filters.status?.length)  params.set('status',      filters.status.join(','));
    if (filters.environment)     params.set('environment',  filters.environment);
    if (filters.startAfter)      params.set('startAfter',   filters.startAfter);
    if (filters.startBefore)     params.set('startBefore',  filters.startBefore);
    if (filters.groupName)       params.set('groupName',    filters.groupName);
    if (filters.source)          params.set('source',       filters.source);
    return `${API_URL}/api/executions/grouped?${params.toString()}`;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useGroupedExecutions = (filters: IGroupedFilters = {}) => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    const { enabled: callerEnabled = true, ...restFilters } = filters;

    const queryKey = ['executions-grouped', token, restFilters] as const;
    const queryKeyRef = useRef(queryKey);
    queryKeyRef.current = queryKey;

    // ── Data fetching ─────────────────────────────────────────────────────────
    const { data: page, isLoading: loading, error } = useQuery<IExecutionGroupPage>({
        queryKey,
        queryFn: async () => {
            const { data } = await axios.get(buildGroupedUrl(restFilters), {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (data.success && data.data) {
                return data.data as IExecutionGroupPage;
            }
            return { groups: [], totalGroups: 0, limit: restFilters.limit ?? 10, offset: restFilters.offset ?? 0 };
        },
        // Only fetch when the caller enables the hook AND we have an auth token
        enabled: !!token && callerEnabled,
        staleTime: 0,
    });

    // ── Socket.io real-time updates ───────────────────────────────────────────
    // When an execution inside a group is updated we patch it in-place.
    // If the execution is new or belongs to a group not on the current page,
    // we invalidate so the next query fetch reflects the true state.
    useEffect(() => {
        if (!token) return;

        const socket = io(API_URL, {
            auth: { token },
            transports: ['websocket'],
        });

        socket.on('execution-updated', (updated: Partial<Execution>) => {
            const current = queryClient.getQueryData<IExecutionGroupPage>(queryKeyRef.current);
            if (!current) return;

            let found = false;

            const nextGroups = current.groups.map((group): IExecutionGroup => {
                const idx = group.executions.findIndex((ex) => ex.taskId === updated.taskId);
                if (idx === -1) return group;

                found = true;
                const nextExecutions = [...group.executions];
                nextExecutions[idx] = { ...nextExecutions[idx], ...updated };

                // Recalculate summary for this group
                const passCount = nextExecutions.filter((ex) => ex.status === 'PASSED').length;
                const lastRunAt =
                    nextExecutions.reduce((latest, ex) =>
                        new Date(ex.startTime) > new Date(latest) ? ex.startTime : latest,
                        nextExecutions[0]?.startTime ?? group.lastRunAt,
                    );

                return { ...group, executions: nextExecutions, passCount, lastRunAt };
            });

            if (found) {
                queryClient.setQueryData(queryKeyRef.current, (old: IExecutionGroupPage | undefined) =>
                    old ? { ...old, groups: nextGroups } : old,
                );
            } else {
                queryClient.invalidateQueries({ queryKey: queryKeyRef.current });
            }
        });

        return () => { socket.disconnect(); };
    }, [queryClient, token]);

    const errorMessage =
        error instanceof Error ? error.message : error ? String(error) : null;

    return {
        groups:      page?.groups      ?? [],
        totalGroups: page?.totalGroups ?? 0,
        limit:       page?.limit       ?? (filters.limit  ?? 10),
        offset:      page?.offset      ?? (filters.offset ?? 0),
        loading,
        error: errorMessage,
    };
};
