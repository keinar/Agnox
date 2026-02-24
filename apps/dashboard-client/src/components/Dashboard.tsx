import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useExecutions, type IExecutionFilters } from '../hooks/useExecutions';
import { useGroupedExecutions } from '../hooks/useGroupedExecutions';
import { useGroupNames } from '../hooks/useGroupNames';
import { useDashboardData } from '../hooks/useDashboardData';
import { useAnalyticsKPIs } from '../hooks/useAnalyticsKPIs';
import { useAuth } from '../context/AuthContext';
import { StatsGrid } from './StatsGrid';
import { FilterBar } from './FilterBar';
import { Pagination } from './Pagination';
import { ExecutionModal } from './ExecutionModal';
import { ExecutionList } from './dashboard/ExecutionList';
import { ExecutionDrawer, type DrawerTab } from './ExecutionDrawer';
import { Play } from 'lucide-react';
import type { ViewMode } from '../types';

// ── localStorage key for view mode persistence ────────────────────────────────

const LS_VIEW_MODE_KEY = 'aac:view-mode';

function loadViewMode(): ViewMode {
  try {
    const stored = localStorage.getItem(LS_VIEW_MODE_KEY);
    if (stored === 'flat' || stored === 'grouped') return stored;
  } catch { /* ignore */ }
  return 'flat';
}

const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_URL = isProduction
  ? import.meta.env.VITE_API_URL || ''
  : 'http://localhost:3000';

// ── Default filter state — exported so FilterBar can reference the shape ──────

const DEFAULT_FILTERS: IExecutionFilters = {
  status: [],
  environment: '',
  startAfter: '',
  startBefore: '',
  groupName: '',
  limit: 25,
  offset: 0,
};

// ── Component ─────────────────────────────────────────────────────────────────

export const Dashboard = () => {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const { availableFolders, defaults } = useDashboardData();
  const { kpis, isLoading: kpisLoading } = useAnalyticsKPIs();
  const groupNames = useGroupNames();

  // ── View mode — persisted to localStorage ─────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    try { localStorage.setItem(LS_VIEW_MODE_KEY, mode); } catch { /* ignore */ }
    // Reset offset when switching modes to avoid stale pagination
    setFilters((prev) => ({ ...prev, offset: 0 }));
  }, []);

  // ── Filter + pagination state ─────────────────────────────────────────────
  // All filter changes reset offset to 0 (back to page 1).
  // Page navigation only changes offset.
  const [filters, setFilters] = useState<IExecutionFilters>(DEFAULT_FILTERS);

  const handleFilterChange = useCallback(
    (patch: Partial<Pick<IExecutionFilters, 'status' | 'environment' | 'startAfter' | 'startBefore' | 'groupName'>>) => {
      setFilters((prev) => ({ ...prev, ...patch, offset: 0 }));
    },
    [],
  );

  const handlePageChange = useCallback((newOffset: number) => {
    setFilters((prev) => ({ ...prev, offset: newOffset }));
  }, []);

  // ── Data — flat list ──────────────────────────────────────────────────────
  const {
    executions, total, limit, offset,
    loading, error, setExecutions,
  } = useExecutions(filters);

  // ── Data — grouped view ───────────────────────────────────────────────────
  // Groups per page default: 10. Reuse filters; limit/offset map to group units.
  const {
    groups,
    totalGroups,
    limit: groupLimit,
    offset: groupOffset,
    loading: groupsLoading,
    error: groupsError,
  } = useGroupedExecutions({
    status: filters.status,
    environment: filters.environment,
    startAfter: filters.startAfter,
    startBefore: filters.startBefore,
    groupName: filters.groupName,
    limit: 10,
    offset: filters.offset,
    enabled: viewMode === 'grouped',  // Only fetch when grouped view is active
  });

  // Choose which loading / error state to surface
  const activeLoading = viewMode === 'grouped' ? groupsLoading : loading;
  const activeError = viewMode === 'grouped' ? groupsError : error;

  const [isModalOpen, setIsModalOpen] = useState(false);

  // ── Drawer — URL-based state ──────────────────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams();
  const drawerId = searchParams.get('drawerId');
  const drawerTab = (searchParams.get('drawerTab') ?? undefined) as DrawerTab | undefined;

  // Resolve the full execution object from the current page cache so TerminalView
  // receives live socket-driven updates without a second connection.
  const drawerExecution = executions.find((e) => e.taskId === drawerId) ?? null;

  const handleCloseDrawer = useCallback(() => {
    setSearchParams((prev) => {
      prev.delete('drawerId');
      prev.delete('drawerTab');
      return prev;
    });
  }, [setSearchParams]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleRunTest = async (formData: {
    folder: string;
    environment: string;
    baseUrl: string;
    image: string;
    command: string;
    groupName?: string;
  }) => {
    try {
      const payload: Record<string, unknown> = {
        taskId: `run-${Date.now()}`,
        trigger: 'manual',
        image: formData.image,
        command: formData.command,
        folder: formData.folder,
        tests: [formData.folder],
        config: {
          environment: formData.environment,
          baseUrl: formData.baseUrl,
          retryAttempts: 2,
        },
      };

      // Include groupName only when the user provided one
      if (formData.groupName) payload.groupName = formData.groupName;

      const response = await fetch(`${API_URL}/api/execution-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Server validation failed');
      }

      await response.json();
      setIsModalOpen(false);
    } catch (err: any) {
      alert(`Error launching test: ${err.message}`);
    }
  };

  const handleDelete = useCallback(async (taskId: string) => {
    if (!window.confirm('Delete this execution?')) return;
    try {
      await fetch(`${API_URL}/api/executions/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setExecutions((old) => old.filter((exec) => exec.taskId !== taskId));
      queryClient.invalidateQueries({ queryKey: ['executions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    } catch {
      alert('Delete failed');
    }
  }, [token, setExecutions, queryClient]);

  // ── Bulk delete — soft-deletes all selected executions in one request ──────
  const handleBulkDelete = useCallback(async (taskIds: string[]) => {
    try {
      const res = await fetch(`${API_URL}/api/executions/bulk`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ taskIds }),
      });
      if (!res.ok) throw new Error('Server error');
      // Optimistic update for the flat view cache
      setExecutions((old) => old.filter((e) => !taskIds.includes(e.taskId)));
      // Refresh all execution queries and stats so the UI reflects the deletions
      queryClient.invalidateQueries({ queryKey: ['executions'] });
      queryClient.invalidateQueries({ queryKey: ['executions-grouped'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    } catch (err: unknown) {
      alert('Bulk delete failed');
      throw err; // rethrow so ExecutionList keeps the selection intact
    }
  }, [token, setExecutions, queryClient]);

  // ── Bulk group — assigns a groupName to all selected executions ───────────
  const handleBulkGroup = useCallback(async (taskIds: string[], groupName: string) => {
    try {
      const res = await fetch(`${API_URL}/api/executions/bulk`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ taskIds, data: { groupName } }),
      });
      if (!res.ok) throw new Error('Server error');
      // Optimistic update for the flat view cache
      setExecutions((old) =>
        old.map((e) => (taskIds.includes(e.taskId) ? { ...e, groupName } : e)),
      );
      // Refresh grouped view to reflect new group memberships
      queryClient.invalidateQueries({ queryKey: ['executions-grouped'] });
    } catch (err: unknown) {
      alert('Bulk group update failed');
      throw err;
    }
  }, [token, setExecutions, queryClient]);

  const isViewer = user?.role === 'viewer';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="px-6 py-6 min-w-0 w-full">
      {/* Title + Run button */}
      <div className="flex flex-row items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="m-0 text-lg md:text-2xl font-bold text-slate-900 dark:text-gh-text-dark tracking-tight">
            Automation Center
          </h1>
          <p className="text-slate-700 dark:text-slate-400 mt-1 text-xs md:text-sm">Live monitoring of test infrastructure</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          disabled={isViewer}
          title={isViewer ? 'Viewers cannot run tests' : 'Run a new test'}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm md:px-4 md:py-2 md:text-base rounded-lg font-semibold transition-all duration-200 ${isViewer
            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 border border-gray-200 dark:border-gray-700 cursor-not-allowed'
            : 'bg-gh-accent dark:bg-gh-accent-dark text-white cursor-pointer hover:opacity-90 active:scale-95'
            }`}
        >
          <Play size={16} className="md:w-[18px] md:h-[18px]" /> Run
        </button>
      </div>

      {/* KPI stats */}
      <StatsGrid executions={executions} kpis={kpis} kpisLoading={kpisLoading} />

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        onChange={handleFilterChange}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        groupNames={groupNames}
      />

      {/* Execution table — flat or grouped */}
      <ExecutionList
        executions={executions}
        loading={activeLoading}
        error={activeError}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        onBulkGroup={handleBulkGroup}
        viewMode={viewMode}
        groups={groups}
      />

      {/* Pagination — adapts to flat vs grouped counts */}
      {viewMode === 'grouped' ? (
        <Pagination
          total={totalGroups}
          limit={groupLimit}
          offset={groupOffset}
          onPageChange={handlePageChange}
          loading={groupsLoading}
        />
      ) : (
        <Pagination
          total={total}
          limit={limit}
          offset={offset}
          onPageChange={handlePageChange}
          loading={loading}
        />
      )}

      {/* Run modal */}
      <ExecutionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleRunTest}
        availableFolders={availableFolders}
        defaults={defaults}
        existingGroupNames={groupNames}
        token={token}
        apiUrl={API_URL}
      />

      {/* Execution detail drawer — driven by ?drawerId= URL param */}
      <ExecutionDrawer
        executionId={drawerId}
        execution={drawerExecution}
        onClose={handleCloseDrawer}
        defaultTab={drawerTab}
      />
    </div>
  );
};
