import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Tag, X, Loader2 } from 'lucide-react';

interface BulkActionsBarProps {
  count: number;
  onDelete: () => Promise<void>;
  onGroup: (groupName: string) => Promise<void>;
  onClear: () => void;
}

export function BulkActionsBar({ count, onDelete, onGroup, onClear }: BulkActionsBarProps) {
  const [groupPopoverOpen, setGroupPopoverOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState<'delete' | 'group' | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close group popover on outside click
  useEffect(() => {
    if (!groupPopoverOpen) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setGroupPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [groupPopoverOpen]);

  // Auto-focus input when popover opens
  useEffect(() => {
    if (groupPopoverOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [groupPopoverOpen]);

  const handleDelete = async () => {
    setLoading('delete');
    try {
      await onDelete();
    } catch {
      // Error is alerted upstream; keep bar visible so user can retry
    } finally {
      setLoading(null);
    }
  };

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = groupName.trim();
    if (!trimmed) return;
    setLoading('group');
    try {
      await onGroup(trimmed);
      setGroupName('');
      setGroupPopoverOpen(false);
    } catch {
      // Error is alerted upstream; keep popover open for retry
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700">
      {/* Selection count badge */}
      <span className="flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-indigo-500 text-xs font-bold">
        {count}
      </span>
      <span className="text-sm font-medium text-slate-300 mr-1">selected</span>

      <div className="w-px h-5 bg-slate-600 mx-1" />

      {/* Bulk Delete — count shown on button for confirmation clarity */}
      <button
        onClick={handleDelete}
        disabled={!!loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading === 'delete'
          ? <Loader2 size={13} className="animate-spin" />
          : <Trash2 size={13} />}
        Delete {count}
      </button>

      {/* Group — triggers a small popover for group name input */}
      <div className="relative" ref={popoverRef}>
        <button
          onClick={() => setGroupPopoverOpen(v => !v)}
          disabled={!!loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === 'group'
            ? <Loader2 size={13} className="animate-spin" />
            : <Tag size={13} />}
          Group
        </button>

        {groupPopoverOpen && (
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 w-64">
            <p className="text-xs font-semibold text-slate-700 mb-3">
              Assign group to {count} execution{count !== 1 ? 's' : ''}
            </p>
            <form onSubmit={handleGroupSubmit} className="flex flex-col gap-2">
              <input
                ref={inputRef}
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Nightly Sanity"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={!groupName.trim()}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply Group
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-slate-600 mx-1" />

      {/* Clear selection */}
      <button
        onClick={onClear}
        title="Clear selection"
        className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-200"
      >
        <X size={14} />
      </button>
    </div>
  );
}
