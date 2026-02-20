import React, { useState, useEffect } from 'react';
import { Info, X, Play, Folder, Server, Globe, Box, Terminal, Tag, ChevronDown, ChevronRight } from 'lucide-react';

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

export const ExecutionModal: React.FC<ExecutionModalProps> = ({ isOpen, onClose, onSubmit, availableFolders, defaults }) => {
    const [environment, setEnvironment] = useState('development');
    const [baseUrl, setBaseUrl] = useState('');
    const [selectedFolder, setSelectedFolder] = useState('all');
    const [groupName, setGroupName] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Agnostic defaults
    const [image, setImage] = useState('');
    const [command, setCommand] = useState('');

    useEffect(() => {
        if (defaults?.envMapping && defaults.envMapping[environment]) {
            setBaseUrl(defaults.envMapping[environment]);
        }
    }, [environment, defaults]);

    useEffect(() => {
        if (isOpen && defaults) {
            if (defaults.image) setImage(defaults.image);
            if (defaults.folder) setSelectedFolder(defaults.folder);

            // Auto-select the first environment that has a configured URL
            if (defaults.envMapping) {
                const envPriority = ['production', 'staging', 'development'];
                const firstConfigured = envPriority.find(env => defaults.envMapping?.[env]);
                if (firstConfigured) {
                    setEnvironment(firstConfigured);
                    setBaseUrl(defaults.envMapping[firstConfigured]);
                }
            } else if (defaults.baseUrl) {
                setBaseUrl(defaults.baseUrl);
            }
        }
    }, [defaults, isOpen]);

    useEffect(() => {
        // If showAdvanced is on, we don't overwrite manual changes
        if (showAdvanced) return;

        const getCleanPath = (folder: string) => {
            if (folder === 'all' || !folder) return 'all';
            return folder.replace(/^tests\//, '');
        };

        const targetFolder = getCleanPath(selectedFolder);

        // This is just for UI display/preview.
        // The backend will ignore this string and use its internal agnostic logic.
        setCommand(`Agnostic Execution Mode: Running [${targetFolder}] via entrypoint.sh`);
    }, [selectedFolder, showAdvanced]);

    // Reset groupName field when the modal closes so it does not persist across opens
    useEffect(() => {
        if (!isOpen) setGroupName('');
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalFolder = selectedFolder;
        const trimmedGroup = groupName.trim();
        onSubmit({
            folder: finalFolder,
            environment,
            baseUrl,
            image,
            command,
            ...(trimmedGroup ? { groupName: trimmedGroup } : {}),
        });
    };

    const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-slide-up">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                        <Play size={20} className="text-indigo-500" />
                        Launch Agnostic Execution
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
                    {/* Test Folder */}
                    <div className="flex flex-col gap-1.5">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <Folder size={16} className="text-slate-400" /> Test Folder (Path)
                        </label>
                        {availableFolders.length > 0 ? (
                            <select
                                value={selectedFolder}
                                onChange={(e) => setSelectedFolder(e.target.value)}
                                className={inputClass}
                            >
                                <option value="all">Run All Tests</option>
                                {availableFolders.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        ) : (
                            <input
                                type="text"
                                className={inputClass}
                                placeholder="e.g. tests/ui or all"
                                value={selectedFolder}
                                onChange={(e) => setSelectedFolder(e.target.value)}
                            />
                        )}
                        <p className="text-xs text-slate-400">Path inside the Docker image</p>
                    </div>

                    {/* Environment */}
                    <div className="flex flex-col gap-1.5">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <Server size={16} className="text-slate-400" /> Environment
                            <span title="Environments are mapped from system ENV variables (e.g. STAGING_URL)">
                                <Info size={14} className="cursor-help text-slate-400" />
                            </span>
                        </label>
                        <select
                            value={environment}
                            onChange={(e) => setEnvironment(e.target.value)}
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
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <Globe size={16} className="text-slate-400" /> Target URL
                        </label>
                        <input
                            type="url"
                            required
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            className={inputClass}
                            placeholder={defaults?.baseUrl ? undefined : 'Not configured — go to Settings → Run Settings'}
                        />
                    </div>

                    {/* Group Name (optional) */}
                    <div className="flex flex-col gap-1.5">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <Tag size={16} className="text-slate-400" /> Group Name
                            <span className="text-xs text-slate-400 font-normal">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            className={inputClass}
                            placeholder="e.g. Nightly Sanity, Regression Suite"
                            maxLength={128}
                        />
                        <p className="text-xs text-slate-400">Assign this run to a logical group for easier filtering and grouped view</p>
                    </div>

                    {/* Execution Strategy Preview */}
                    <div className="flex flex-col gap-1.5">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <Terminal size={16} className="text-slate-400" /> Execution Strategy
                        </label>
                        <div className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 font-mono text-xs text-sky-400">
                            {command}
                        </div>
                    </div>

                    {/* Advanced Configuration Toggle */}
                    <button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors cursor-pointer py-1"
                    >
                        {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        Advanced Container Configuration
                    </button>

                    {showAdvanced && (
                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                    <Box size={16} className="text-slate-400" /> Docker Image
                                </label>
                                <input
                                    type="text"
                                    value={image}
                                    onChange={(e) => setImage(e.target.value)}
                                    className={`${inputClass} font-mono text-xs`}
                                    placeholder={defaults?.image ? undefined : 'Not configured — go to Settings → Run Settings'}
                                />
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex justify-end gap-3 pt-2 mt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer shadow-sm"
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
