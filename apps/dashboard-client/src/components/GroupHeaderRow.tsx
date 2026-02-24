import React from 'react';
import { ChevronRight, Layers } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { IExecutionGroup } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GroupHeaderRowProps {
    group: IExecutionGroup;
    isExpanded: boolean;
    onToggle: () => void;
    /** Total number of visible table columns — used for the colspan. */
    colCount: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimeAgo(dateString: string): string {
    try {
        return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
        return '';
    }
}

function getPassRateBadgeClass(passed: number, total: number): string {
    if (total === 0) return 'bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/50';
    const rate = passed / total;
    if (rate === 1) return 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50';
    if (rate >= 0.75) return 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50';
    return 'bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50';
}

// ── Component ─────────────────────────────────────────────────────────────────

export const GroupHeaderRow: React.FC<GroupHeaderRowProps> = ({
    group,
    isExpanded,
    onToggle,
    colCount,
}) => {
    const { groupName, totalCount, passCount, lastRunAt } = group;

    const displayName =
        groupName === '__ungrouped__' ? 'Ungrouped Runs' : groupName;

    const badgeClass = getPassRateBadgeClass(passCount, totalCount);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
        }
    };

    return (
        <tr
            tabIndex={0}
            onClick={onToggle}
            onKeyDown={handleKeyDown}
            aria-expanded={isExpanded}
            aria-label={`${displayName} group — ${passCount}/${totalCount} passed`}
            className="h-14 border-b border-gh-border dark:border-gh-border-dark bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer select-none transition-colors duration-150"
        >
            <td colSpan={colCount} className="px-4 py-4">
                <div className="flex items-center gap-3">
                    {/* Expand / collapse chevron — rotates 90° when the group is expanded */}
                    <ChevronRight
                        size={14}
                        className={`text-slate-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                    />

                    {/* Group icon */}
                    <Layers size={14} className="text-blue-500 flex-shrink-0" />

                    {/* Group name */}
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate max-w-xs">
                        {displayName}
                    </span>

                    {/* Pass summary badge */}
                    <span
                        className={`
                            inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold
                            border ${badgeClass}
                        `}
                    >
                        {passCount}/{totalCount} Passed
                    </span>

                    {/* Spacer */}
                    <span className="flex-1" />

                    {/* Last run timestamp */}
                    {lastRunAt && (
                        <span className="text-[11px] text-slate-400 whitespace-nowrap flex-shrink-0">
                            Last run: {formatTimeAgo(lastRunAt)}
                        </span>
                    )}
                </div>
            </td>
        </tr>
    );
};
