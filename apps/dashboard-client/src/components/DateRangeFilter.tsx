import React from 'react';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { Calendar, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';

// ── Types ─────────────────────────────────────────────────────────────────────

interface IDateRangeFilterProps {
    startAfter: string;
    startBefore: string;
    onStartAfterChange: (value: string) => void;
    onStartBeforeChange: (value: string) => void;
}

// ── Shared classes ────────────────────────────────────────────────────────────

const DATE_INPUT_CLASS =
    'w-full px-2.5 py-1.5 text-xs border border-slate-200 dark:border-gh-border-dark rounded-lg ' +
    'bg-white dark:bg-gh-bg-dark text-slate-700 dark:text-slate-300 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-gh-accent-dark focus:border-blue-400 ' +
    'transition cursor-pointer';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateShort(iso: string): string {
    if (!iso) return '';
    try {
        return format(parseISO(iso), 'MMM d');
    } catch {
        return iso;
    }
}

// ── Component ─────────────────────────────────────────────────────────────────

export const DateRangeFilter: React.FC<IDateRangeFilterProps> = ({
    startAfter,
    startBefore,
    onStartAfterChange,
    onStartBeforeChange,
}) => {
    const hasRange = startAfter !== '' || startBefore !== '';

    const buttonLabel = (() => {
        const from = formatDateShort(startAfter);
        const to   = formatDateShort(startBefore);
        if (from && to) return `${from} – ${to}`;
        if (from)       return `From ${from}`;
        if (to)         return `To ${to}`;
        return 'All time';
    })();

    return (
        <Popover className="relative">
            {/* ── Trigger button ── */}
            <PopoverButton
                className={`
                    inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border
                    transition-colors cursor-pointer
                    focus:outline-none focus-visible:ring-2
                    focus-visible:ring-blue-400 dark:focus-visible:ring-gh-accent-dark
                    ${hasRange
                        ? 'border-blue-300 dark:border-gh-accent-dark bg-blue-50 dark:bg-gh-bg-dark text-blue-700 dark:text-gh-accent-dark'
                        : 'border-slate-200 dark:border-gh-border-dark bg-white dark:bg-gh-bg-dark text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gh-bg-subtle-dark'
                    }
                `}
            >
                <Calendar size={12} />
                <span>{buttonLabel}</span>
            </PopoverButton>

            {/* ── Dropdown panel ── */}
            <PopoverPanel
                anchor="bottom start"
                className="z-30 mt-1.5 w-60 rounded-xl border border-slate-200 dark:border-gh-border-dark bg-white dark:bg-gh-bg-dark shadow-xl p-4 space-y-3"
            >
                {({ close }) => (
                    <>
                        {/* Panel header */}
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                Date Range
                            </span>
                            {hasRange && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onStartAfterChange('');
                                        onStartBeforeChange('');
                                        close();
                                    }}
                                    className="inline-flex items-center gap-0.5 text-[11px] text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                                >
                                    <X size={10} />
                                    Clear
                                </button>
                            )}
                        </div>

                        {/* From */}
                        <div>
                            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                                From
                            </label>
                            <input
                                type="date"
                                value={startAfter}
                                max={startBefore || undefined}
                                onChange={(e) => onStartAfterChange(e.target.value)}
                                className={DATE_INPUT_CLASS}
                            />
                        </div>

                        {/* To */}
                        <div>
                            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                                To
                            </label>
                            <input
                                type="date"
                                value={startBefore}
                                min={startAfter || undefined}
                                onChange={(e) => onStartBeforeChange(e.target.value)}
                                className={DATE_INPUT_CLASS}
                            />
                        </div>
                    </>
                )}
            </PopoverPanel>
        </Popover>
    );
};
