import React, { useState } from 'react';
import {
    Dialog,
    DialogBackdrop,
    DialogPanel,
    DialogTitle,
} from '@headlessui/react';
import { Filter, X, List, LayoutList, Tag, Cloud } from 'lucide-react';
import type { IExecutionFilters } from '../hooks/useExecutions';
import type { ViewMode } from '../types';
import { DateRangeFilter } from './DateRangeFilter';

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterPatch = Partial<
    Pick<IExecutionFilters, 'status' | 'environment' | 'startAfter' | 'startBefore' | 'groupName' | 'source'>
>;

interface FilterBarProps {
    filters: Pick<IExecutionFilters, 'status' | 'environment' | 'startAfter' | 'startBefore' | 'groupName' | 'source'>;
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
        inactive: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50',
        active: 'bg-emerald-600 text-white border-emerald-600',
    },
    {
        value: 'FAILED',
        label: 'Failed',
        inactive: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/50',
        active: 'bg-rose-600 text-white border-rose-600',
    },
    {
        value: 'ERROR',
        label: 'Error',
        inactive: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/50',
        active: 'bg-rose-600 text-white border-rose-600',
    },
    {
        value: 'UNSTABLE',
        label: 'Unstable',
        inactive: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50',
        active: 'bg-amber-500 text-white border-amber-500',
    },
] as const;

const ENV_OPTIONS = [
    { value: '', label: 'All' },
    { value: 'development', label: 'Dev' },
    { value: 'staging', label: 'Staging' },
    { value: 'production', label: 'Prod' },
] as const;

const SOURCE_OPTIONS = [
    { value: '', label: 'All' },
    { value: 'agnox-hosted', label: 'Agnox Hosted' },
    { value: 'external-ci', label: 'External CI' },
] as const;

/** Stable empty default for the groupNames prop — avoids a new array reference on every render. */
const EMPTY_GROUP_NAMES: string[] = [];

// ── Shared classes ────────────────────────────────────────────────────────────

const SECTION_LABEL = 'text-[11px] text-slate-400 dark:text-slate-500 font-medium flex-shrink-0';

const DRAWER_DATE_INPUT =
    'w-full px-2.5 py-1.5 text-xs border border-slate-200 dark:border-gh-border-dark rounded-lg ' +
    'bg-white dark:bg-gh-bg-dark text-slate-700 dark:text-slate-300 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-gh-accent-dark focus:border-blue-400 ' +
    'transition cursor-pointer';

// ── Sub-renders ───────────────────────────────────────────────────────────────

/** Inline divider for the desktop filter row. */
const DesktopDivider = () => (
    <div className="hidden sm:block w-px h-4 bg-slate-200 dark:bg-gh-border-dark flex-shrink-0" />
);

/** Horizontal rule between sections in the mobile drawer. */
const DrawerDivider = () => (
    <div className="h-px bg-slate-100 dark:bg-gh-border-dark" />
);

// ── GroupInput ────────────────────────────────────────────────────────────────

interface IGroupInputProps {
    /** Unique datalist id — avoids duplicate DOM ids when rendered in both desktop and drawer. */
    datalistId: string;
    groupName: string;
    groupNames: string[];
    onChange: (patch: FilterPatch) => void;
}

const GroupInput: React.FC<IGroupInputProps> = ({ datalistId, groupName, groupNames, onChange }) => (
    <div className="relative">
        <input
            type="text"
            list={datalistId}
            value={groupName}
            onChange={(e) => onChange({ groupName: e.target.value })}
            placeholder="All groups"
            className={`
                px-2.5 py-1.5 text-xs border rounded-lg
                bg-white dark:bg-gh-bg-dark text-slate-700 dark:text-slate-300
                focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-gh-accent-dark focus:border-blue-400
                transition w-full placeholder:text-slate-400 dark:placeholder:text-slate-600
                ${groupName
                    ? 'pr-6 border-blue-300 dark:border-gh-accent-dark'
                    : 'border-slate-200 dark:border-gh-border-dark'
                }
            `}
        />
        <datalist id={datalistId}>
            {groupNames.map((name) => (
                <option key={name} value={name} />
            ))}
        </datalist>
        {groupName && (
            <button
                type="button"
                onClick={() => onChange({ groupName: '' })}
                title="Clear group filter"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
                <X size={10} />
            </button>
        )}
    </div>
);

// ── Component ─────────────────────────────────────────────────────────────────

export const FilterBar: React.FC<FilterBarProps> = ({
    filters,
    onChange,
    viewMode,
    onViewModeChange,
    groupNames = EMPTY_GROUP_NAMES,
}) => {
    const [drawerOpen, setDrawerOpen] = useState(false);

    const {
        status = [],
        environment = '',
        startAfter = '',
        startBefore = '',
        groupName = '',
        source = '',
    } = filters;

    const isActive =
        status.length > 0 ||
        environment !== '' ||
        startAfter !== '' ||
        startBefore !== '' ||
        groupName !== '' ||
        source !== '';

    // Count how many filter categories are active (for the badge).
    const activeCount = [
        status.length > 0,
        environment !== '',
        startAfter !== '' || startBefore !== '',
        groupName !== '',
        source !== '',
    ].filter(Boolean).length;

    const toggleStatus = (value: string) => {
        const next = status.includes(value)
            ? status.filter((s) => s !== value)
            : [...status, value];
        onChange({ status: next });
    };

    const handleClear = () =>
        onChange({ status: [], environment: '', startAfter: '', startBefore: '', groupName: '', source: '' });

    // ── Shared section renders ─────────────────────────────────────────────────

    const statusChips = (
        <div className="flex items-center gap-1.5 flex-wrap">
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
    );

    const envButtons = (
        <div className="inline-flex w-auto max-w-[240px] sm:max-w-full overflow-x-auto whitespace-nowrap scrollbar-hide rounded-lg border border-slate-200 dark:border-gh-border-dark">
            {ENV_OPTIONS.map((opt, i) => {
                const isSelected = environment === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange({ environment: opt.value })}
                        className={`
                            px-2.5 py-1 text-[11px] font-semibold transition-colors duration-100 cursor-pointer
                            ${i > 0 ? 'border-l border-slate-200 dark:border-gh-border-dark' : ''}
                            ${isSelected
                                ? 'bg-blue-600 dark:bg-gh-accent-dark text-white'
                                : 'bg-white dark:bg-gh-bg-dark text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gh-bg-subtle-dark'
                            }
                        `}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );


    const sourceButtons = (
        <div className="inline-flex w-auto max-w-[280px] sm:max-w-full overflow-x-auto whitespace-nowrap scrollbar-hide rounded-lg border border-slate-200 dark:border-gh-border-dark">
            {SOURCE_OPTIONS.map((opt, i) => {
                const isSelected = source === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange({ source: opt.value as IExecutionFilters['source'] })}
                        className={`
                            px-2.5 py-1 text-[11px] font-semibold transition-colors duration-100 cursor-pointer
                            ${i > 0 ? 'border-l border-slate-200 dark:border-gh-border-dark' : ''}
                            ${isSelected
                                ? 'bg-violet-600 dark:bg-violet-700 text-white'
                                : 'bg-white dark:bg-gh-bg-dark text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gh-bg-subtle-dark'
                            }
                        `}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );

    const viewModeToggle = (size: number) => (
        <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-gh-border-dark">
            <button
                type="button"
                title="Flat list — one row per execution"
                onClick={() => onViewModeChange('flat')}
                className={`
                    inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold
                    transition-colors duration-100 cursor-pointer
                    ${viewMode === 'flat'
                        ? 'bg-blue-600 dark:bg-gh-accent-dark text-white'
                        : 'bg-white dark:bg-gh-bg-dark text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gh-bg-subtle-dark'
                    }
                `}
            >
                <List size={size} />
                Flat
            </button>
            <button
                type="button"
                title="Grouped view — executions bucketed by group name"
                onClick={() => onViewModeChange('grouped')}
                className={`
                    inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold
                    border-l border-slate-200 dark:border-gh-border-dark transition-colors duration-100 cursor-pointer
                    ${viewMode === 'grouped'
                        ? 'bg-blue-600 dark:bg-gh-accent-dark text-white'
                        : 'bg-white dark:bg-gh-bg-dark text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gh-bg-subtle-dark'
                    }
                `}
            >
                <LayoutList size={size} />
                Grouped
            </button>
        </div>
    );

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <>
            <div className="bg-white dark:bg-gh-bg-subtle-dark border border-slate-200 dark:border-gh-border-dark rounded-xl shadow-sm px-4 py-3 mb-4">

                {/* ── Desktop: inline filter row (hidden on mobile) ── */}
                <div className="hidden md:flex flex-wrap items-center gap-x-5 gap-y-2.5">

                    {/* Label */}
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wide flex-shrink-0">
                        <Filter size={12} />
                        Filters
                        {isActive && (
                            <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold">
                                {activeCount}
                            </span>
                        )}
                    </div>

                    <DesktopDivider />

                    {/* Status */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={SECTION_LABEL}>Status:</span>
                        {statusChips}
                    </div>

                    <DesktopDivider />

                    {/* Environment */}
                    <div className="flex items-center gap-1.5">
                        <span className={SECTION_LABEL}>Env:</span>
                        {envButtons}
                    </div>

                    <DesktopDivider />

                    {/* Date range — unified popover */}
                    <DateRangeFilter
                        startAfter={startAfter}
                        startBefore={startBefore}
                        onStartAfterChange={(v) => onChange({ startAfter: v })}
                        onStartBeforeChange={(v) => onChange({ startBefore: v })}
                    />

                    <DesktopDivider />

                    {/* Group */}
                    <div className="flex items-center gap-1.5">
                        <span className={`flex items-center gap-1 ${SECTION_LABEL}`}>
                            <Tag size={10} />
                            Group:
                        </span>
                        <div className="w-36">
                            <GroupInput
                                datalistId="aac-group-datalist-desktop"
                                groupName={groupName}
                                groupNames={groupNames}
                                onChange={onChange}
                            />
                        </div>
                    </div>

                    <DesktopDivider />

                    {/* Source */}
                    <div className="flex items-center gap-1.5">
                        <span className={`flex items-center gap-1 ${SECTION_LABEL}`}>
                            <Cloud size={10} />
                            Source:
                        </span>
                        {sourceButtons}
                    </div>

                    <DesktopDivider />

                    {/* View mode */}
                    <div className="flex items-center gap-1.5">
                        <span className={SECTION_LABEL}>View:</span>
                        {viewModeToggle(11)}
                    </div>

                    {/* Clear */}
                    {isActive && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="ml-auto flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-gh-bg-dark border border-slate-200 dark:border-gh-border-dark rounded-lg hover:bg-slate-200 dark:hover:bg-gh-bg-subtle-dark hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        >
                            <X size={11} />
                            Clear
                        </button>
                    )}
                </div>

                {/* ── Mobile: trigger row (hidden on desktop) ── */}
                <div className="flex md:hidden items-center gap-3">

                    {/* "Filters" button — opens the drawer */}
                    <button
                        type="button"
                        onClick={() => setDrawerOpen(true)}
                        className={`
                            inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors cursor-pointer
                            ${isActive
                                ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                                : 'bg-white dark:bg-gh-bg-dark text-slate-600 dark:text-slate-300 border-slate-200 dark:border-gh-border-dark hover:bg-slate-50 dark:hover:bg-gh-bg-subtle-dark'
                            }
                        `}
                    >
                        <Filter size={14} />
                        Filters
                        {isActive && (
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white text-blue-600 text-[9px] font-bold">
                                {activeCount}
                            </span>
                        )}
                    </button>

                    {/* View mode — stays accessible on mobile without opening the drawer */}
                    {viewModeToggle(12)}

                    {/* Inline clear shortcut */}
                    {isActive && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="ml-auto flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-gh-bg-dark border border-slate-200 dark:border-gh-border-dark rounded-lg hover:bg-slate-200 dark:hover:bg-gh-bg-subtle-dark transition-colors cursor-pointer"
                        >
                            <X size={11} />
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* ── Mobile filter drawer (Headless UI Dialog, bottom sheet) ── */}
            <Dialog
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                className="relative z-50"
            >
                {/* Translucent backdrop */}
                <DialogBackdrop
                    transition
                    className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm duration-200 ease-out data-[closed]:opacity-0"
                />

                {/* Slide-up bottom sheet */}
                <div className="fixed inset-x-0 bottom-0">
                    <DialogPanel
                        transition
                        className="bg-white dark:bg-gh-bg-dark rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col duration-300 ease-in-out data-[closed]:translate-y-full"
                    >
                        {/* Drag handle */}
                        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                            <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-gh-border-dark" />
                        </div>

                        {/* Drawer header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-gh-border-dark flex-shrink-0">
                            <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-gh-text-dark">
                                <Filter size={14} />
                                Filters
                                {isActive && (
                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold">
                                        {activeCount}
                                    </span>
                                )}
                            </DialogTitle>
                            <button
                                type="button"
                                onClick={() => setDrawerOpen(false)}
                                aria-label="Close filter drawer"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gh-bg-subtle-dark transition-colors cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Scrollable filter controls */}
                        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

                            {/* Status */}
                            <div className="space-y-2">
                                <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                    Status
                                </span>
                                {statusChips}
                            </div>

                            <DrawerDivider />

                            {/* Environment */}
                            <div className="space-y-2">
                                <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                    Environment
                                </span>
                                {envButtons}
                            </div>

                            <DrawerDivider />

                            {/* Date Range — rendered inline (no nested Popover needed in a drawer) */}
                            <div className="space-y-2">
                                <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                    Date Range
                                </span>
                                <div className="space-y-2">
                                    <div>
                                        <label htmlFor="drawer-date-from" className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                                            From
                                        </label>
                                        <input
                                            id="drawer-date-from"
                                            type="date"
                                            value={startAfter}
                                            max={startBefore || undefined}
                                            onChange={(e) => onChange({ startAfter: e.target.value })}
                                            className={DRAWER_DATE_INPUT}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="drawer-date-to" className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                                            To
                                        </label>
                                        <input
                                            id="drawer-date-to"
                                            type="date"
                                            value={startBefore}
                                            min={startAfter || undefined}
                                            onChange={(e) => onChange({ startBefore: e.target.value })}
                                            className={DRAWER_DATE_INPUT}
                                        />
                                    </div>
                                </div>
                            </div>

                            <DrawerDivider />

                            {/* Group */}
                            <div className="space-y-2">
                                <span className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                    <Tag size={11} />
                                    Group
                                </span>
                                <GroupInput
                                    datalistId="aac-group-datalist-mobile"
                                    groupName={groupName}
                                    groupNames={groupNames}
                                    onChange={onChange}
                                />
                            </div>

                            <DrawerDivider />

                            {/* Source */}
                            <div className="space-y-2">
                                <span className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                    <Cloud size={11} />
                                    Source
                                </span>
                                {sourceButtons}
                            </div>
                        </div>

                        {/* Drawer footer — Clear all + Apply */}
                        <div className="flex-shrink-0 px-5 py-4 border-t border-slate-100 dark:border-gh-border-dark flex items-center gap-3">
                            {isActive ? (
                                <button
                                    type="button"
                                    onClick={handleClear}
                                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-gh-bg-subtle-dark border border-slate-200 dark:border-gh-border-dark rounded-lg hover:bg-slate-200 dark:hover:bg-gh-bg-dark transition-colors cursor-pointer"
                                >
                                    <X size={13} />
                                    Clear all
                                </button>
                            ) : (
                                <div />
                            )}
                            <button
                                type="button"
                                onClick={() => setDrawerOpen(false)}
                                className="flex-1 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                            >
                                Apply
                            </button>
                        </div>
                    </DialogPanel>
                </div>
            </Dialog>
        </>
    );
};
