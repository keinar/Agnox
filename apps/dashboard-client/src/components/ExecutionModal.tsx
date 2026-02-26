import React, { useReducer, useEffect, useState, useMemo } from 'react';
import { Combobox, ComboboxInput, ComboboxButton, ComboboxOptions, ComboboxOption } from '@headlessui/react';
import { Info, X, Play, Folder, Server, Globe, Box, Terminal, Tag, ChevronDown, ChevronRight, Clock, CheckCircle, AlertCircle } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExecutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: {
        folder: string;
        environment: string;
        baseUrl: string;
        image: string;
        command: string;
        groupName?: string;
    }) => void;
    availableFolders: string[];
    existingGroupNames?: string[];
    defaults?: {
        image: string;
        baseUrl: string;
        folder: string;
        envMapping?: Record<string, string>;
    };
    /** JWT bearer token — required to call POST /api/schedules. */
    token?: string | null;
    /** API base URL — defaults to localhost:3000 in development. */
    apiUrl?: string;
}

// ── CRON preset helpers ────────────────────────────────────────────────────────

const CRON_PRESETS = [
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Daily at 2 AM', value: '0 2 * * *' },
    { label: 'Daily at midnight', value: '0 0 * * *' },
    { label: 'Every Mon at 9 AM', value: '0 9 * * 1' },
    { label: 'Every 6 hours', value: '0 */6 * * *' },
] as const;

// ── Reducer ───────────────────────────────────────────────────────────────────

interface ModalState {
    environment: string;
    baseUrl: string;
    selectedFolder: string;
    groupName: string;
    showAdvanced: boolean;
    image: string;
    command: string;
}

type ModalAction =
    | { type: 'SET_ENVIRONMENT'; value: string }
    | { type: 'SET_BASE_URL'; value: string }
    | { type: 'SET_FOLDER'; value: string }
    | { type: 'SET_GROUP_NAME'; value: string }
    | { type: 'TOGGLE_ADVANCED' }
    | { type: 'SET_IMAGE'; value: string }
    | { type: 'SET_COMMAND'; value: string }
    | { type: 'RESET_GROUP_NAME' }
    | { type: 'INIT_FROM_DEFAULTS'; environment: string; baseUrl: string; image: string; folder: string };

const MODAL_INITIAL_STATE: ModalState = {
    environment: 'development',
    baseUrl: '',
    selectedFolder: 'all',
    groupName: '',
    showAdvanced: false,
    image: '',
    command: '',
};

function modalReducer(state: ModalState, action: ModalAction): ModalState {
    switch (action.type) {
        case 'SET_ENVIRONMENT':
            return { ...state, environment: action.value };
        case 'SET_BASE_URL':
            return { ...state, baseUrl: action.value };
        case 'SET_FOLDER':
            return { ...state, selectedFolder: action.value };
        case 'SET_GROUP_NAME':
            return { ...state, groupName: action.value };
        case 'TOGGLE_ADVANCED':
            return { ...state, showAdvanced: !state.showAdvanced };
        case 'SET_IMAGE':
            return { ...state, image: action.value };
        case 'SET_COMMAND':
            return { ...state, command: action.value };
        case 'RESET_GROUP_NAME':
            return { ...state, groupName: '' };
        case 'INIT_FROM_DEFAULTS':
            return {
                ...state,
                environment: action.environment,
                baseUrl: action.baseUrl,
                image: action.image,
                selectedFolder: action.folder,
            };
        default:
            return state;
    }
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ExecutionModal: React.FC<ExecutionModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    availableFolders,
    existingGroupNames,
    defaults,
    token,
    apiUrl,
}) => {
    const [state, dispatch] = useReducer(modalReducer, MODAL_INITIAL_STATE);
    const { environment, baseUrl, selectedFolder, groupName, showAdvanced, image, command } = state;

    const [comboQuery, setComboQuery] = useState('');

    // ── Schedule mode state ────────────────────────────────────────────────────
    type RunMode = 'immediate' | 'schedule';
    const [runMode, setRunMode] = useState<RunMode>('immediate');
    const [scheduleName, setScheduleName] = useState('');
    const [cronExpression, setCronExpression] = useState('0 2 * * *');
    const [scheduleStatus, setScheduleStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [isSavingSchedule, setIsSavingSchedule] = useState(false);

    const filteredGroupNames = useMemo(
        () => (existingGroupNames ?? []).filter((n) => n.toLowerCase().includes(comboQuery.toLowerCase())),
        [existingGroupNames, comboQuery],
    );

    const showCreateOption =
        comboQuery.trim().length > 0 &&
        !filteredGroupNames.some((n) => n.toLowerCase() === comboQuery.trim().toLowerCase());

    const hasDropdownOptions = filteredGroupNames.length > 0 || showCreateOption;

    // Sync baseUrl when environment selection changes and envMapping is available
    useEffect(() => {
        if (defaults?.envMapping && defaults.envMapping[environment]) {
            dispatch({ type: 'SET_BASE_URL', value: defaults.envMapping[environment] });
        }
    }, [environment, defaults]);

    // Apply project defaults when the modal opens
    useEffect(() => {
        if (!isOpen || !defaults) return;

        const envPriority = ['production', 'staging', 'development'] as const;
        const firstConfigured = defaults.envMapping
            ? envPriority.find((env) => defaults.envMapping?.[env])
            : undefined;

        dispatch({
            type: 'INIT_FROM_DEFAULTS',
            environment: firstConfigured ?? environment,
            baseUrl: firstConfigured
                ? (defaults.envMapping?.[firstConfigured] ?? defaults.baseUrl ?? '')
                : (defaults.baseUrl ?? ''),
            image: defaults.image ?? '',
            folder: defaults.folder ?? 'all',
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [defaults, isOpen]);

    // Derive the command preview from the selected folder (ignored when advanced mode is on)
    useEffect(() => {
        if (showAdvanced) return;
        const cleanPath =
            selectedFolder === 'all' || !selectedFolder
                ? 'all'
                : selectedFolder.replace(/^tests\//, '');
        dispatch({
            type: 'SET_COMMAND',
            value: `Execution Mode: Running [${cleanPath}] via entrypoint.sh`,
        });
    }, [selectedFolder, showAdvanced]);

    // Reset all transient state when the modal closes so it does not persist across opens
    useEffect(() => {
        if (!isOpen) {
            dispatch({ type: 'RESET_GROUP_NAME' });
            setComboQuery('');
            setRunMode('immediate');
            setScheduleName('');
            setCronExpression('0 2 * * *');
            setScheduleStatus(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedGroup = groupName.trim();
        onSubmit({
            folder: selectedFolder,
            environment,
            baseUrl,
            image,
            command,
            ...(trimmedGroup ? { groupName: trimmedGroup } : {}),
        });
    };

    // ── Save schedule handler ──────────────────────────────────────────────────

    const handleSaveSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        setScheduleStatus(null);

        if (!scheduleName.trim()) {
            setScheduleStatus({ type: 'error', message: 'Schedule name is required.' });
            return;
        }
        if (!cronExpression.trim()) {
            setScheduleStatus({ type: 'error', message: 'CRON expression is required.' });
            return;
        }

        const resolvedApiUrl = apiUrl ?? (
            window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? 'http://localhost:3000'
                : ''
        );

        setIsSavingSchedule(true);
        try {
            const res = await fetch(`${resolvedApiUrl}/api/schedules`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    name: scheduleName.trim(),
                    cronExpression: cronExpression.trim(),
                    environment,
                    image,
                    folder: selectedFolder || 'all',
                    baseUrl,
                }),
            });

            const json = await res.json();

            if (!res.ok || !json.success) {
                setScheduleStatus({ type: 'error', message: json.error ?? 'Failed to save schedule.' });
                return;
            }

            setScheduleStatus({ type: 'success', message: `Schedule "${scheduleName.trim()}" saved successfully!` });
            // Close the modal after a short delay so the user can see the success message
            setTimeout(() => onClose(), 1800);
        } catch {
            setScheduleStatus({ type: 'error', message: 'Network error — could not save schedule.' });
        } finally {
            setIsSavingSchedule(false);
        }
    };

    const inputClass =
        'w-full rounded-lg border border-slate-200 dark:border-gh-border-dark bg-white dark:bg-gh-bg-dark ' +
        'px-3 py-2 text-sm text-slate-900 dark:text-gh-text-dark placeholder-slate-400 dark:placeholder-slate-500 ' +
        'focus:outline-none focus:ring-2 focus:ring-gh-accent dark:focus:ring-gh-accent-dark focus:border-transparent transition-shadow';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-gh-bg-subtle-dark border border-slate-300 dark:border-gh-border-dark rounded-2xl shadow-2xl w-full max-w-lg animate-slide-up">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-gh-border-dark">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-gh-text-dark">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                <Play size={20} />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">
                                {runMode === 'immediate' ? 'Launch Execution' : 'Schedule Execution'}
                            </h2>
                        </div>
                    </h3>
                    <button
                        onClick={onClose}
                        aria-label="Close modal"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-gh-bg-dark transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Run Mode Toggle */}
                <div className="px-6 pt-4">
                    <div className="flex rounded-lg border border-slate-200 dark:border-gh-border-dark overflow-hidden text-sm font-medium">
                        <button
                            type="button"
                            onClick={() => { setRunMode('immediate'); setScheduleStatus(null); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 transition-colors cursor-pointer ${runMode === 'immediate'
                                ? 'bg-gh-accent dark:bg-gh-accent-dark text-white'
                                : 'bg-white dark:bg-gh-bg-dark text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gh-bg-subtle-dark'
                                }`}
                        >
                            <Play size={14} />
                            Run Immediately
                        </button>
                        <button
                            type="button"
                            onClick={() => { setRunMode('schedule'); setScheduleStatus(null); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 border-l border-slate-200 dark:border-gh-border-dark transition-colors cursor-pointer ${runMode === 'schedule'
                                ? 'bg-amber-500 dark:bg-amber-600 text-white'
                                : 'bg-white dark:bg-gh-bg-dark text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gh-bg-subtle-dark'
                                }`}
                        >
                            <Clock size={14} />
                            Schedule Run
                        </button>
                    </div>
                </div>

                <form
                    onSubmit={runMode === 'immediate' ? handleSubmit : handleSaveSchedule}
                    className="flex flex-col"
                >
                    {/* Scrollable form body */}
                    <div className="overflow-y-auto max-h-[60vh] px-6 py-5 flex flex-col gap-4">

                        {/* Test Folder */}
                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="modal-folder"
                                className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300"
                            >
                                <Folder size={16} className="text-slate-400 dark:text-slate-500" /> Test Folder (Path)
                            </label>
                            {availableFolders.length > 0 ? (
                                <select
                                    id="modal-folder"
                                    value={selectedFolder}
                                    onChange={(e) => dispatch({ type: 'SET_FOLDER', value: e.target.value })}
                                    className={inputClass}
                                >
                                    <option value="all">Run All Tests</option>
                                    {availableFolders.map((f) => (
                                        <option key={f} value={f}>{f}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    id="modal-folder"
                                    type="text"
                                    className={inputClass}
                                    placeholder="e.g. tests/ui or all"
                                    value={selectedFolder}
                                    onChange={(e) => dispatch({ type: 'SET_FOLDER', value: e.target.value })}
                                />
                            )}
                            <p className="text-xs text-slate-400">Path inside the Docker image</p>
                        </div>

                        {/* Environment */}
                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="modal-env"
                                className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300"
                            >
                                <Server size={16} className="text-slate-400 dark:text-slate-500" /> Environment
                                <span title="Environments are mapped from Project Configuration settings">
                                    <Info size={14} className="cursor-help text-slate-400 dark:text-slate-500" />
                                </span>
                            </label>
                            <select
                                id="modal-env"
                                value={environment}
                                onChange={(e) => dispatch({ type: 'SET_ENVIRONMENT', value: e.target.value })}
                                className={inputClass}
                            >
                                {!defaults?.envMapping || Object.keys(defaults.envMapping).length === 0 ? (
                                    <>
                                        <option value="development">Development (Default)</option>
                                        <option value="custom">Custom URL</option>
                                    </>
                                ) : (
                                    Object.keys(defaults.envMapping).map((envKey) => (
                                        <option key={envKey} value={envKey}>
                                            {envKey.toUpperCase()}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>

                        {/* Target URL */}
                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="modal-url"
                                className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300"
                            >
                                <Globe size={16} className="text-slate-400 dark:text-slate-500" /> Target URL
                            </label>
                            <input
                                id="modal-url"
                                type="url"
                                required
                                value={baseUrl}
                                onChange={(e) => dispatch({ type: 'SET_BASE_URL', value: e.target.value })}
                                className={inputClass}
                                placeholder={defaults?.baseUrl ? undefined : 'Not configured — go to Settings → Run Settings'}
                            />
                        </div>

                        {/* Group Name (optional) — smart combobox: select existing or type to create */}
                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="modal-group"
                                className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300"
                            >
                                <Tag size={16} className="text-slate-400 dark:text-slate-500" /> Group Name
                                <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">(optional)</span>
                            </label>
                            <Combobox
                                as="div"
                                className="relative"
                                value={groupName}
                                onChange={(val: string | null) => {
                                    dispatch({ type: 'SET_GROUP_NAME', value: val ?? '' });
                                    setComboQuery('');
                                }}
                            >
                                <div className="relative">
                                    <ComboboxInput
                                        id="modal-group"
                                        className={`${inputClass} ${existingGroupNames?.length ? 'pr-8' : ''}`}
                                        placeholder="e.g. Nightly Sanity, Regression Suite"
                                        maxLength={128}
                                        displayValue={(val: string) => val}
                                        onChange={(e) => {
                                            setComboQuery(e.target.value);
                                            dispatch({ type: 'SET_GROUP_NAME', value: e.target.value });
                                        }}
                                    />
                                    {existingGroupNames && existingGroupNames.length > 0 && (
                                        <ComboboxButton
                                            aria-label="Show existing groups"
                                            className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                        >
                                            <ChevronDown size={14} />
                                        </ComboboxButton>
                                    )}
                                </div>

                                {hasDropdownOptions && (
                                    <ComboboxOptions className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 dark:border-gh-border-dark bg-white dark:bg-gh-bg-dark shadow-lg max-h-48 overflow-y-auto focus:outline-none py-1">
                                        {filteredGroupNames.map((name) => (
                                            <ComboboxOption
                                                key={name}
                                                value={name}
                                                className={({ active }: { active: boolean }) =>
                                                    `cursor-pointer select-none px-3 py-2 text-sm transition-colors ${active
                                                        ? 'bg-slate-100 dark:bg-gh-bg-subtle-dark text-slate-900 dark:text-gh-text-dark'
                                                        : 'text-slate-700 dark:text-slate-300'
                                                    }`
                                                }
                                            >
                                                {name}
                                            </ComboboxOption>
                                        ))}
                                        {showCreateOption && (
                                            <ComboboxOption
                                                value={comboQuery.trim()}
                                                className={({ active }: { active: boolean }) =>
                                                    `cursor-pointer select-none px-3 py-2 text-sm transition-colors ${active
                                                        ? 'bg-slate-100 dark:bg-gh-bg-subtle-dark text-slate-900 dark:text-gh-text-dark'
                                                        : 'text-slate-700 dark:text-slate-300'
                                                    }`
                                                }
                                            >
                                                <span className="font-medium text-gh-accent dark:text-gh-accent-dark">Create</span>{' '}
                                                &ldquo;{comboQuery.trim()}&rdquo;
                                            </ComboboxOption>
                                        )}
                                    </ComboboxOptions>
                                )}
                            </Combobox>
                            <p className="text-xs text-slate-400">Select an existing group or type a new name to create one</p>
                        </div>

                        {/* Execution Strategy Preview */}
                        <div className="flex flex-col gap-1.5">
                            <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                                <Terminal size={16} className="text-slate-400 dark:text-slate-500" /> Execution Strategy
                            </span>
                            <div
                                role="status"
                                aria-label="Execution strategy preview"
                                className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 font-mono text-xs text-sky-400"
                            >
                                {command}
                            </div>
                        </div>

                        {/* Advanced Configuration Toggle */}
                        <button
                            type="button"
                            onClick={() => dispatch({ type: 'TOGGLE_ADVANCED' })}
                            aria-expanded={showAdvanced}
                            className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer py-1"
                        >
                            {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            Advanced Container Configuration
                        </button>

                        {showAdvanced && (
                            <div className="rounded-xl bg-slate-50 dark:bg-gh-bg-dark border border-slate-200 dark:border-gh-border-dark p-4">
                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="modal-image"
                                        className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300"
                                    >
                                        <Box size={16} className="text-slate-400 dark:text-slate-500" /> Docker Image
                                    </label>
                                    <input
                                        id="modal-image"
                                        type="text"
                                        value={image}
                                        onChange={(e) => dispatch({ type: 'SET_IMAGE', value: e.target.value })}
                                        className={`${inputClass} font-mono text-xs`}
                                        placeholder={defaults?.image ? undefined : 'Not configured — go to Settings → Run Settings'}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Schedule-specific fields — only visible in schedule mode */}
                        {runMode === 'schedule' && (
                            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-4 flex flex-col gap-3">
                                {/* Schedule name */}
                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="schedule-name"
                                        className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300"
                                    >
                                        <Clock size={16} className="text-amber-500" /> Schedule Name
                                    </label>
                                    <input
                                        id="schedule-name"
                                        type="text"
                                        required
                                        maxLength={128}
                                        placeholder="e.g. Nightly Regression"
                                        value={scheduleName}
                                        onChange={(e) => setScheduleName(e.target.value)}
                                        className={inputClass}
                                    />
                                </div>

                                {/* CRON expression */}
                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="schedule-cron"
                                        className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300"
                                    >
                                        CRON Expression
                                    </label>
                                    <input
                                        id="schedule-cron"
                                        type="text"
                                        required
                                        placeholder="e.g. 0 2 * * *"
                                        value={cronExpression}
                                        onChange={(e) => setCronExpression(e.target.value)}
                                        className={`${inputClass} font-mono`}
                                    />
                                    {/* Preset chips */}
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                        {CRON_PRESETS.map((preset) => (
                                            <button
                                                key={preset.value}
                                                type="button"
                                                onClick={() => setCronExpression(preset.value)}
                                                className={`px-2 py-0.5 rounded-full text-xs font-mono border transition-colors cursor-pointer ${cronExpression === preset.value
                                                    ? 'bg-amber-500 text-white border-amber-500'
                                                    : 'bg-white dark:bg-gh-bg-dark border-slate-200 dark:border-gh-border-dark text-slate-600 dark:text-slate-400 hover:border-amber-400'
                                                    }`}
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-400">
                                        Format: <span className="font-mono">minute hour day month weekday</span>
                                        {' '}— e.g. <span className="font-mono">0 2 * * *</span> = daily at 2 AM UTC
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Inline status message (schedule mode only) */}
                        {scheduleStatus && (
                            <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${scheduleStatus.type === 'success'
                                ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50 text-green-800 dark:text-green-300'
                                : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-300'
                                }`}>
                                {scheduleStatus.type === 'success'
                                    ? <CheckCircle size={16} className="mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
                                    : <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
                                }
                                {scheduleStatus.message}
                            </div>
                        )}

                    </div>{/* end scrollable body */}

                    {/* Footer — always visible, outside scroll area */}
                    <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-gh-border-dark">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-gh-bg-dark border border-slate-200 dark:border-gh-border-dark hover:bg-slate-50 dark:hover:bg-gh-bg-subtle-dark transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        {runMode === 'immediate' ? (
                            <button
                                type="submit"
                                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-gh-accent dark:bg-gh-accent-dark hover:opacity-90 transition-colors cursor-pointer shadow-sm"
                            >
                                <Play size={16} />
                                Launch Execution
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={isSavingSchedule}
                                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-60 transition-colors cursor-pointer shadow-sm"
                            >
                                <Clock size={16} />
                                {isSavingSchedule ? 'Saving…' : 'Save Schedule'}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};
