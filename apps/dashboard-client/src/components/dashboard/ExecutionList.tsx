import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Settings2, ChevronDown } from 'lucide-react';
import { ExecutionRow } from '../ExecutionRow';

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

const MANDATORY_KEYS = new Set(COLUMN_DEFS.filter(c => c.mandatory).map(c => c.key));

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

function loadVisibility(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) {
        return new Set([...MANDATORY_KEYS, ...parsed]);
      }
    }
  } catch { /* ignore parse errors */ }
  return new Set(COLUMN_DEFS.map(c => c.key));
}

interface ExecutionListProps {
  executions: Execution[];
  loading: boolean;
  error: string | null;
  expandedRowId: string | null;
  onToggleRow: (id: string) => void;
  onDelete: (taskId: string) => Promise<void>;
}

export function ExecutionList({
  executions,
  loading,
  error,
  expandedRowId,
  onToggleRow,
  onDelete,
}: ExecutionListProps) {
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(loadVisibility);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Persist optional column preferences on every change
  useEffect(() => {
    const optionalVisible = COLUMN_DEFS
      .filter(c => !c.mandatory && visibleColumns.has(c.key))
      .map(c => c.key);
    localStorage.setItem(LS_KEY, JSON.stringify(optionalVisible));
  }, [visibleColumns]);

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popoverOpen]);

  const toggleColumn = useCallback((key: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const visibleDefs = COLUMN_DEFS.filter(c => c.mandatory || visibleColumns.has(c.key));
  const visibleColCount = visibleDefs.length;

  if (error) {
    return (
      <div className="text-rose-600 text-center p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">
          {loading && executions.length === 0
            ? 'Loading\u2026'
            : `${executions.length} execution${executions.length !== 1 ? 's' : ''}`}
        </span>

        {/* Columns popover */}
        <div className="relative" ref={popoverRef}>
          <button
            onClick={() => setPopoverOpen(v => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
          >
            <Settings2 size={13} />
            Columns
            <ChevronDown
              size={12}
              className={`transition-transform duration-150 ${popoverOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {popoverOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-50 w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5">
              <p className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                Toggle columns
              </p>
              {COLUMN_DEFS.map(col => {
                const isChecked = col.mandatory || visibleColumns.has(col.key);
                return (
                  <label
                    key={col.key}
                    className={`flex items-center gap-2.5 px-3 py-2 text-sm select-none ${
                      col.mandatory
                        ? 'opacity-50 cursor-not-allowed'
                        : 'cursor-pointer hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={col.mandatory}
                      onChange={() => toggleColumn(col.key)}
                      className="w-3.5 h-3.5 rounded accent-indigo-600"
                    />
                    <span className="text-slate-700 flex-1">{col.label}</span>
                    {col.mandatory && (
                      <span className="text-[10px] text-slate-400">Required</span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {visibleDefs.map(col => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap ${
                    col.key === 'actions' ? 'text-right' : ''
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && executions.length === 0 &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-100">
                  {visibleDefs.map(col => (
                    <td key={col.key} className="px-4 py-3.5">
                      <div
                        className={`animate-pulse bg-slate-200 rounded-md h-4 ${
                          SKELETON_WIDTHS[col.key] ?? 'w-20'
                        }`}
                      />
                    </td>
                  ))}
                </tr>
              ))
            }

            {executions.map((exec) => (
              <ExecutionRow
                key={exec._id || exec.taskId}
                execution={exec}
                isExpanded={expandedRowId === (exec._id || exec.taskId)}
                onToggle={() => onToggleRow(exec._id || exec.taskId)}
                onDelete={onDelete}
                visibleColumns={visibleColumns}
                visibleColCount={visibleColCount}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
