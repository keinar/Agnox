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
    if (total === 0) return 'bg-slate-100 text-slate-500 border-slate-200';
    const rate = passed / total;
    if (rate === 1)    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (rate >= 0.75)  return 'bg-amber-100   text-amber-700   border-amber-200';
    return                    'bg-rose-100    text-rose-700    border-rose-200';
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
            className="h-14 border-b border-gh-border bg-gh-bg-subtle hover:bg-blue-50/40 cursor-pointer select-none transition-colors duration-150"
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
                    <span className="text-sm font-semibold text-slate-700 truncate max-w-xs">
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
