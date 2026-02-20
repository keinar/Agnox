import React from 'react';
import { Filter, X, List, LayoutList, Tag } from 'lucide-react';
import type { IExecutionFilters } from '../hooks/useExecutions';
import type { ViewMode } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterPatch = Partial<
    Pick<IExecutionFilters, 'status' | 'environment' | 'startAfter' | 'startBefore' | 'groupName'>
>;

interface FilterBarProps {
    filters: Pick<IExecutionFilters, 'status' | 'environment' | 'startAfter' | 'startBefore' | 'groupName'>;
    onChange: (patch: FilterPatch) => void;
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
    /** Available group names for the filter combobox datalist. */
    groupNames?: string[];
}

// ── Static config ─────────────────────────────────────────────────────────────

const STATUS_CHIPS = [
    {
        value: 'PASSED',
        label: 'Passed',
        inactive: 'bg-emerald-50  text-emerald-700 border-emerald-200 hover:bg-emerald-100',
        active:   'bg-emerald-600 text-white        border-emerald-600',
    },
    {
        value: 'FAILED',
        label: 'Failed',
        inactive: 'bg-rose-50  text-rose-700 border-rose-200 hover:bg-rose-100',
        active:   'bg-rose-600 text-white     border-rose-600',
    },
    {
        value: 'ERROR',
        label: 'Error',
        inactive: 'bg-rose-50  text-rose-700 border-rose-200 hover:bg-rose-100',
        active:   'bg-rose-600 text-white     border-rose-600',
    },
    {
        value: 'UNSTABLE',
        label: 'Unstable',
        inactive: 'bg-amber-50  text-amber-700 border-amber-200 hover:bg-amber-100',
        active:   'bg-amber-500 text-white      border-amber-500',
    },
] as const;

const ENV_OPTIONS = [
    { value: '',             label: 'All'     },
    { value: 'development',  label: 'Dev'     },
    { value: 'staging',      label: 'Staging' },
    { value: 'production',   label: 'Prod'    },
] as const;

/** Stable empty default for the groupNames prop — avoids a new array reference on every render. */
const EMPTY_GROUP_NAMES: string[] = [];

// ── Shared classes ────────────────────────────────────────────────────────────

const DATE_INPUT_CLASS =
    'px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 ' +
    'transition cursor-pointer';

// ── Component ─────────────────────────────────────────────────────────────────

export const FilterBar: React.FC<FilterBarProps> = ({
    filters,
    onChange,
    viewMode,
    onViewModeChange,
    groupNames = EMPTY_GROUP_NAMES,
}) => {
    const { status = [], environment = '', startAfter = '', startBefore = '', groupName = '' } = filters;

    const isActive =
        status.length > 0 ||
        environment !== '' ||
        startAfter  !== '' ||
        startBefore !== '' ||
        groupName   !== '';

    // Count how many filter categories are active (for the badge)
    const activeCount = [
        status.length > 0,
        environment !== '',
        startAfter !== '' || startBefore !== '',
        groupName !== '',
    ].filter(Boolean).length;

    // Toggle a status chip on/off in the multi-select list.
    const toggleStatus = (value: string) => {
        const next = status.includes(value)
            ? status.filter((s) => s !== value)
            : [...status, value];
        onChange({ status: next });
    };

    const handleClear = () =>
        onChange({ status: [], environment: '', startAfter: '', startBefore: '', groupName: '' });

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3 mb-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">

                {/* ── Label ── */}
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide flex-shrink-0">
                    <Filter size={12} />
                    Filters
                    {isActive && (
                        <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold">
                            {activeCount}
                        </span>
                    )}
                </div>

                {/* ── Divider ── */}
                <div className="hidden sm:block w-px h-4 bg-slate-200 flex-shrink-0" />

                {/* ── Status chips ── */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-400 font-medium flex-shrink-0">Status:</span>
                    {STATUS_CHIPS.map((chip) => {
                        const isSelected = status.includes(chip.value);
                        return (
                            <button
                                key={chip.value}
                                type="button"
                                onClick={() => toggleStatus(chip.value)}
                                className={`
                                    inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold
                                    border transition-colors duration-100 cursor-pointer
                                    ${isSelected ? chip.active : chip.inactive}
                                `}
                            >
                                {chip.label}
                            </button>
                        );
                    })}
                </div>

                {/* ── Divider ── */}
                <div className="hidden sm:block w-px h-4 bg-slate-200 flex-shrink-0" />

                {/* ── Environment ── */}
                <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-400 font-medium flex-shrink-0">Env:</span>
                    <div className="flex rounded-lg overflow-hidden border border-slate-200">
                        {ENV_OPTIONS.map((opt, i) => {
                            const isSelected = environment === opt.value;
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => onChange({ environment: opt.value })}
                                    className={`
                                        px-2.5 py-1 text-[11px] font-semibold transition-colors duration-100 cursor-pointer
                                        ${i > 0 ? 'border-l border-slate-200' : ''}
                                        ${isSelected
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white text-slate-600 hover:bg-slate-50'
                                        }
                                    `}
                                >
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Divider ── */}
                <div className="hidden sm:block w-px h-4 bg-slate-200 flex-shrink-0" />

                {/* ── Date range ── */}
                <div className="flex items-center gap-2">
                    <label
                        htmlFor="filter-start-after"
                        className="text-[11px] text-slate-400 font-medium flex-shrink-0"
                    >
                        From:
                    </label>
                    <input
                        id="filter-start-after"
                        type="date"
                        value={startAfter}
                        max={startBefore || undefined}
                        onChange={(e) => onChange({ startAfter: e.target.value })}
                        className={DATE_INPUT_CLASS}
                    />
                    <label
                        htmlFor="filter-start-before"
                        className="text-[11px] text-slate-400 font-medium"
                    >
                        To:
                    </label>
                    <input
                        id="filter-start-before"
                        type="date"
                        value={startBefore}
                        min={startAfter || undefined}
                        onChange={(e) => onChange({ startBefore: e.target.value })}
                        className={DATE_INPUT_CLASS}
                    />
                </div>

                {/* ── Divider ── */}
                <div className="hidden sm:block w-px h-4 bg-slate-200 flex-shrink-0" />

                {/* ── Group filter (searchable combobox) ── */}
                <div className="flex items-center gap-1.5">
                    <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium flex-shrink-0">
                        <Tag size={10} />
                        Group:
                    </span>
                    <div className="relative">
                        <input
                            type="text"
                            list="aac-group-names-datalist"
                            value={groupName}
                            onChange={(e) => onChange({ groupName: e.target.value })}
                            placeholder="All groups"
                            className={`
                                px-2.5 py-1.5 text-xs border rounded-lg bg-white text-slate-700
                                focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400
                                transition w-36 placeholder:text-slate-400
                                ${groupName ? 'pr-6 border-blue-300' : 'border-slate-200'}
                            `}
                        />
                        <datalist id="aac-group-names-datalist">
                            {groupNames.map((name) => (
                                <option key={name} value={name} />
                            ))}
                        </datalist>
                        {groupName && (
                            <button
                                type="button"
                                onClick={() => onChange({ groupName: '' })}
                                title="Clear group filter"
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={10} />
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Divider ── */}
                <div className="hidden sm:block w-px h-4 bg-slate-200 flex-shrink-0" />

                {/* ── View mode segmented control ── */}
                <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-400 font-medium flex-shrink-0">View:</span>
                    <div className="flex rounded-lg overflow-hidden border border-slate-200">
                        <button
                            type="button"
                            title="Flat list — one row per execution"
                            onClick={() => onViewModeChange('flat')}
                            className={`
                                inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold
                                transition-colors duration-100 cursor-pointer
                                ${viewMode === 'flat'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-slate-600 hover:bg-slate-50'
                                }
                            `}
                        >
                            <List size={11} />
                            Flat
                        </button>
                        <button
                            type="button"
                            title="Grouped view — executions bucketed by group name"
                            onClick={() => onViewModeChange('grouped')}
                            className={`
                                inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold
                                border-l border-slate-200 transition-colors duration-100 cursor-pointer
                                ${viewMode === 'grouped'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-slate-600 hover:bg-slate-50'
                                }
                            `}
                        >
                            <LayoutList size={11} />
                            Grouped
                        </button>
                    </div>
                </div>

                {/* ── Clear button — only visible when a filter is active ── */}
                {isActive && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="ml-auto flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
                    >
                        <X size={11} />
                        Clear
                    </button>
                )}
            </div>
        </div>
    );
};
