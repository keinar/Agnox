import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Settings2, ChevronDown } from 'lucide-react';
import { ExecutionRow } from '../ExecutionRow';
import { GroupHeaderRow } from '../GroupHeaderRow';
import { BulkActionsBar } from '../BulkActionsBar';
import type { IExecutionGroup, ViewMode } from '../../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Execution {
  _id?: string;
  taskId: string;
  status: string;
  image: string;
  folder?: string;
  startTime: string;
  endTime?: string;
  config?: {
    environment?: string;
    baseUrl?: string;
  };
  [key: string]: any;
}

interface ColumnDef {
  key: string;
  label: string;
  mandatory: boolean;
  defaultVisible: boolean;
}

// ── Module-level constants ─────────────────────────────────────────────────────

const COLUMN_DEFS: ColumnDef[] = [
  { key: 'runId',       label: 'Run ID',       mandatory: true,  defaultVisible: true },
  { key: 'status',      label: 'Status',       mandatory: true,  defaultVisible: true },
  { key: 'triggeredBy', label: 'Triggered By', mandatory: false, defaultVisible: true },
  { key: 'source',      label: 'Source',       mandatory: false, defaultVisible: true },
  { key: 'environment', label: 'Environment',  mandatory: false, defaultVisible: true },
  { key: 'startTime',   label: 'Start Time',   mandatory: false, defaultVisible: true },
  { key: 'duration',    label: 'Duration',     mandatory: false, defaultVisible: true },
  { key: 'actions',     label: 'Actions',      mandatory: false, defaultVisible: true },
];

const LS_KEY = 'aac:column-visibility';

const MANDATORY_KEYS = new Set(COLUMN_DEFS.filter((c) => c.mandatory).map((c) => c.key));

const SKELETON_WIDTHS: Record<string, string> = {
  runId:       'w-32',
  status:      'w-20',
  triggeredBy: 'w-16',
  source:      'w-24',
  environment: 'w-14',
  startTime:   'w-28',
  duration:    'w-10',
  actions:     'w-20',
};

/** Stable empty array for the `groups` prop default — avoids new reference on every render. */
const EMPTY_GROUPS: IExecutionGroup[] = [];

function loadVisibility(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) return new Set([...MANDATORY_KEYS, ...parsed]);
    }
  } catch { /* ignore parse errors */ }
  return new Set(COLUMN_DEFS.map((c) => c.key));
}

// ── ColumnTogglePopover sub-component ─────────────────────────────────────────

interface ColumnTogglePopoverProps {
  visibleColumns: Set<string>;
  onToggle: (key: string) => void;
}

function ColumnTogglePopover({ visibleColumns, onToggle }: ColumnTogglePopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 bg-white dark:bg-gh-bg-subtle-dark border border-slate-200 dark:border-gh-border-dark rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-gh-bg-dark transition-colors"
      >
        <Settings2 size={13} />
        Columns
        <ChevronDown
          size={12}
          className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Toggle columns"
          className="absolute right-0 top-full mt-1.5 z-50 w-52 bg-white dark:bg-gh-bg-subtle-dark border border-slate-200 dark:border-gh-border-dark rounded-xl shadow-lg py-1.5"
        >
          <p className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
            Toggle columns
          </p>
          {COLUMN_DEFS.map((col) => {
            const isChecked = col.mandatory || visibleColumns.has(col.key);
            return (
              <label
                key={col.key}
                className={`flex items-center gap-2.5 px-3 py-2 text-sm select-none ${
                  col.mandatory
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-gh-bg-dark'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={col.mandatory}
                  onChange={() => onToggle(col.key)}
                  className="w-3.5 h-3.5 rounded accent-blue-600"
                />
                <span className="text-slate-700 dark:text-slate-300 flex-1">{col.label}</span>
                {col.mandatory && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Required</span>
                )}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── ExecutionTableHeader sub-component ────────────────────────────────────────

interface ExecutionTableHeaderProps {
  visibleDefs: ColumnDef[];
  headerCheckboxRef: React.RefObject<HTMLInputElement>;
  isAllSelected: boolean;
  allTaskIds: string[];
  onSelectAll: () => void;
}

function ExecutionTableHeader({
  visibleDefs,
  headerCheckboxRef,
  isAllSelected,
  allTaskIds,
  onSelectAll,
}: ExecutionTableHeaderProps) {
  return (
    <thead className="sticky top-0 z-10">
      <tr className="border-b border-gh-border dark:border-gh-border-dark bg-gh-bg-subtle dark:bg-gh-bg-subtle-dark">
        <th className="px-3 py-4 w-10">
          <input
            ref={headerCheckboxRef}
            type="checkbox"
            checked={isAllSelected}
            onChange={onSelectAll}
            disabled={allTaskIds.length === 0}
            title={isAllSelected ? 'Deselect all' : 'Select all'}
            aria-label={isAllSelected ? 'Deselect all rows' : 'Select all rows'}
            className="w-4 h-4 rounded accent-blue-600 cursor-pointer disabled:cursor-default"
          />
        </th>
        {visibleDefs.map((col) => (
          <th
            key={col.key}
            scope="col"
            className={`px-4 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap ${
              col.key === 'actions' ? 'text-right' : ''
            }`}
          >
            {col.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

// ── SkeletonRows sub-component ────────────────────────────────────────────────

interface SkeletonRowsProps {
  visibleDefs: ColumnDef[];
}

function SkeletonRows({ visibleDefs }: SkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-slate-100 dark:border-gh-border-dark" aria-hidden="true">
          <td className="px-3 py-3.5 w-10">
            <div className="animate-pulse bg-slate-200 dark:bg-slate-700 rounded w-4 h-4" />
          </td>
          {visibleDefs.map((col) => (
            <td key={col.key} className="px-4 py-3.5">
              <div
                className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded-md h-4 ${
                  SKELETON_WIDTHS[col.key] ?? 'w-20'
                }`}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── ExecutionList component ────────────────────────────────────────────────────

interface ExecutionListProps {
  executions: Execution[];
  loading: boolean;
  error: string | null;
  expandedRowId: string | null;
  onToggleRow: (id: string) => void;
  onDelete: (taskId: string) => Promise<void>;
  onBulkDelete: (taskIds: string[]) => Promise<void>;
  onBulkGroup: (taskIds: string[], groupName: string) => Promise<void>;
  viewMode?: ViewMode;
  groups?: IExecutionGroup[];
}

export function ExecutionList({
  executions,
  loading,
  error,
  expandedRowId,
  onToggleRow,
  onDelete,
  onBulkDelete,
  onBulkGroup,
  viewMode = 'flat',
  groups = EMPTY_GROUPS,
}: ExecutionListProps) {
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(loadVisibility);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // ── Bulk selection ─────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allTaskIds = useMemo(
    () =>
      viewMode === 'grouped'
        ? groups.flatMap((g) => g.executions.map((e) => e.taskId))
        : executions.map((e) => e.taskId),
    [viewMode, groups, executions],
  );

  const isAllSelected = allTaskIds.length > 0 && allTaskIds.every((id) => selectedIds.has(id));
  const isSomeSelected = allTaskIds.some((id) => selectedIds.has(id));
  const isIndeterminate = isSomeSelected && !isAllSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [viewMode]);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(isAllSelected ? new Set() : new Set(allTaskIds));
  }, [isAllSelected, allTaskIds]);

  const handleSelect = useCallback((taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const hasGroupedSelected = useMemo(() => {
    if (selectedIds.size === 0) return false;
    if (viewMode === 'grouped') {
      return groups.some((g) =>
        g.executions.some(
          (e) => selectedIds.has(e.taskId) && e.groupName && e.groupName !== '__ungrouped__',
        ),
      );
    }
    return executions.some((e) => selectedIds.has(e.taskId) && !!e.groupName);
  }, [selectedIds, executions, groups, viewMode]);

  const handleBulkDeleteInternal = useCallback(async () => {
    const ids = [...selectedIds];
    try {
      await onBulkDelete(ids);
      setSelectedIds(new Set());
    } catch (err) {
      throw err;
    }
  }, [onBulkDelete, selectedIds]);

  const handleBulkGroupInternal = useCallback(async (groupName: string) => {
    const ids = [...selectedIds];
    try {
      await onBulkGroup(ids, groupName);
      setSelectedIds(new Set());
    } catch (err) {
      throw err;
    }
  }, [onBulkGroup, selectedIds]);

  const handleBulkUngroup = useCallback(async () => {
    const ids = [...selectedIds];
    try {
      await onBulkGroup(ids, '');
      setSelectedIds(new Set());
    } catch (err) {
      throw err;
    }
  }, [onBulkGroup, selectedIds]);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = useCallback((groupName: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  }, []);

  // Persist optional column preferences on every change
  useEffect(() => {
    const optionalVisible = COLUMN_DEFS
      .filter((c) => !c.mandatory && visibleColumns.has(c.key))
      .map((c) => c.key);
    localStorage.setItem(LS_KEY, JSON.stringify(optionalVisible));
  }, [visibleColumns]);

  const toggleColumn = useCallback((key: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const visibleDefs = COLUMN_DEFS.filter((c) => c.mandatory || visibleColumns.has(c.key));
  // +1 accounts for the always-visible checkbox column (not in COLUMN_DEFS)
  const visibleColCount = visibleDefs.length + 1;

  if (error) {
    return (
      <div role="alert" className="text-rose-600 dark:text-rose-400 text-center p-5 bg-white dark:bg-gh-bg-subtle-dark rounded-xl border border-slate-200 dark:border-gh-border-dark shadow-sm">
        Error: {error}
      </div>
    );
  }

  const isLoadingEmpty = loading && executions.length === 0 && groups.length === 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
          {isLoadingEmpty
            ? 'Loading\u2026'
            : viewMode === 'grouped'
                ? `${groups.length} group${groups.length !== 1 ? 's' : ''}`
                : `${executions.length} execution${executions.length !== 1 ? 's' : ''}`}
        </span>

        <ColumnTogglePopover visibleColumns={visibleColumns} onToggle={toggleColumn} />
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto rounded-xl border border-gh-border dark:border-gh-border-dark bg-gh-bg dark:bg-gh-bg-dark shadow-sm">
        <table className="w-full text-sm text-left" role="grid" aria-label="Executions">
          <ExecutionTableHeader
            visibleDefs={visibleDefs}
            headerCheckboxRef={headerCheckboxRef}
            isAllSelected={isAllSelected}
            allTaskIds={allTaskIds}
            onSelectAll={handleSelectAll}
          />
          <tbody>
            {/* Skeleton loading rows */}
            {isLoadingEmpty && <SkeletonRows visibleDefs={visibleDefs} />}

            {/* Grouped mode */}
            {viewMode === 'grouped' && groups.map((group) => {
              const isGroupExpanded = !collapsedGroups.has(group.groupName);
              return (
                <React.Fragment key={group.groupName}>
                  <GroupHeaderRow
                    group={group}
                    isExpanded={isGroupExpanded}
                    onToggle={() => toggleGroup(group.groupName)}
                    colCount={visibleColCount}
                  />
                  {isGroupExpanded && group.executions.map((exec) => (
                    <ExecutionRow
                      key={exec._id || exec.taskId}
                      execution={exec}
                      isExpanded={expandedRowId === (exec._id || exec.taskId)}
                      onToggle={() => onToggleRow(exec._id || exec.taskId)}
                      onDelete={onDelete}
                      onSelect={handleSelect}
                      isSelected={selectedIds.has(exec.taskId)}
                      visibleColumns={visibleColumns}
                      visibleColCount={visibleColCount}
                      animateIn
                    />
                  ))}
                </React.Fragment>
              );
            })}

            {/* Flat mode */}
            {viewMode === 'flat' && executions.map((exec) => (
              <ExecutionRow
                key={exec._id || exec.taskId}
                execution={exec}
                isExpanded={expandedRowId === (exec._id || exec.taskId)}
                onToggle={() => onToggleRow(exec._id || exec.taskId)}
                onDelete={onDelete}
                onSelect={handleSelect}
                isSelected={selectedIds.has(exec.taskId)}
                visibleColumns={visibleColumns}
                visibleColCount={visibleColCount}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Floating bulk actions bar — appears when at least one row is selected */}
      {selectedIds.size > 0 && (
        <BulkActionsBar
          count={selectedIds.size}
          hasGroupedSelected={hasGroupedSelected}
          onDelete={handleBulkDeleteInternal}
          onGroup={handleBulkGroupInternal}
          onUngroup={handleBulkUngroup}
          onClear={() => setSelectedIds(new Set())}
        />
      )}
    </div>
  );
}
