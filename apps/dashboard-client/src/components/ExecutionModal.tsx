import React, { useReducer, useEffect } from 'react';
import { Info, X, Play, Folder, Server, Globe, Box, Terminal, Tag, ChevronDown, ChevronRight } from 'lucide-react';

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
    defaults?: {
        image: string;
        baseUrl: string;
        folder: string;
        envMapping?: Record<string, string>;
    };
}

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

export const ExecutionModal: React.FC<ExecutionModalProps> = ({ isOpen, onClose, onSubmit, availableFolders, defaults }) => {
    const [state, dispatch] = useReducer(modalReducer, MODAL_INITIAL_STATE);
    const { environment, baseUrl, selectedFolder, groupName, showAdvanced, image, command } = state;

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
            value: `Agnostic Execution Mode: Running [${cleanPath}] via entrypoint.sh`,
        });
    }, [selectedFolder, showAdvanced]);

    // Reset groupName field when the modal closes so it does not persist across opens
    useEffect(() => {
        if (!isOpen) dispatch({ type: 'RESET_GROUP_NAME' });
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
                        <Play size={20} className="text-gh-accent dark:text-gh-accent-dark" />
                        Launch Agnostic Execution
                    </h3>
                    <button
                        onClick={onClose}
                        aria-label="Close modal"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-gh-bg-dark transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
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
                            <span title="Environments are mapped from system ENV variables (e.g. STAGING_URL)">
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

                    {/* Group Name (optional) */}
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="modal-group"
                            className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300"
                        >
                            <Tag size={16} className="text-slate-400 dark:text-slate-500" /> Group Name
                            <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">(optional)</span>
                        </label>
                        <input
                            id="modal-group"
                            type="text"
                            value={groupName}
                            onChange={(e) => dispatch({ type: 'SET_GROUP_NAME', value: e.target.value })}
                            className={inputClass}
                            placeholder="e.g. Nightly Sanity, Regression Suite"
                            maxLength={128}
                        />
                        <p className="text-xs text-slate-400">Assign this run to a logical group for easier filtering and grouped view</p>
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

                    {/* Footer */}
                    <div className="flex justify-end gap-3 pt-2 mt-2 border-t border-slate-200 dark:border-gh-border-dark">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-gh-bg-dark border border-slate-200 dark:border-gh-border-dark hover:bg-slate-50 dark:hover:bg-gh-bg-subtle-dark transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-gh-accent dark:bg-gh-accent-dark hover:opacity-90 transition-colors cursor-pointer shadow-sm"
                        >
                            <Play size={16} />
                            Launch Execution
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
