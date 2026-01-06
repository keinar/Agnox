import React, { useState, useEffect } from 'react';
import { Info, X, Play, Folder, Server, Globe, Box, Terminal, ChevronDown, ChevronRight } from 'lucide-react';

interface ExecutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: {
        folder: string;
        environment: string;
        baseUrl: string;
        image: string;
        command: string;
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
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Agnostic defaults
    const [image, setImage] = useState('your_dockerhub_username/my-automation-tests:latest');
    const [command, setCommand] = useState('');

    useEffect(() => {
        if (defaults?.envMapping && defaults.envMapping[environment]) {
            setBaseUrl(defaults.envMapping[environment]);
        }
    }, [environment, defaults]);

    useEffect(() => {
        if (isOpen && defaults) {
            if (defaults.image) setImage(defaults.image);
            if (defaults.baseUrl) setBaseUrl(defaults.baseUrl);
            if (defaults.folder) setSelectedFolder(defaults.folder);
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

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalFolder = selectedFolder;
        onSubmit({
            folder: finalFolder,
            environment,
            baseUrl,
            image,
            command
        });
    };

    return (
        <div className="modal-overlay">
            <div className="modal-container">
                <div className="modal-header">
                    <h3 className="modal-title">
                        <Play size={20} color="#3b82f6" />
                        Launch Agnostic Execution
                    </h3>
                    <button onClick={onClose} className="close-button">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body">
                    {/* Basic Config */}
                    <div className="form-group">
                        <label className="form-label">
                            <Folder size={16} /> Test Folder (Path)
                        </label>
                        {availableFolders.length > 0 ? (
                            <select
                                value={selectedFolder}
                                onChange={(e) => setSelectedFolder(e.target.value)}
                                className="form-input"
                            >
                                <option value="all">Run All Tests</option>
                                {availableFolders.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        ) : (
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g. tests/ui or all"
                                value={selectedFolder}
                                onChange={(e) => setSelectedFolder(e.target.value)}
                            />
                        )}
                        <p className="helper-text">Path inside the Docker image</p>
                    </div>

                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Server size={16} /> Environment
                            <span title="Environments are mapped from system ENV variables (e.g. STAGING_URL)">
                                <Info size={14} style={{ cursor: 'help', color: '#94a3b8' }} />
                            </span>
                        </label>
                        <select
                            value={environment}
                            onChange={(e) => setEnvironment(e.target.value)}
                            className="form-select"
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

                    <div className="form-group">
                        <label className="form-label">
                            <Globe size={16} /> Target URL
                        </label>
                        <input
                            type="url"
                            required
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            className="form-input"
                            placeholder="https://example.com"
                        />
                    </div>

                    <div className="form-group" style={{ marginTop: '1rem' }}>
                        <label className="form-label">
                            <Terminal size={16} /> Execution Strategy
                        </label>
                        <div style={{
                            padding: '10px',
                            backgroundColor: '#0f172a',
                            borderRadius: '6px',
                            border: '1px solid #1e293b',
                            color: '#38bdf8',
                            fontFamily: 'monospace',
                            fontSize: '0.8rem'
                        }}>
                            {command}
                        </div>
                    </div>

                    {/* Advanced Configuration Toggle */}
                    <div
                        className="advanced-toggle"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            fontSize: '0.85rem',
                            marginTop: '1rem',
                            padding: '8px 0'
                        }}
                    >
                        {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        Advanced Container Configuration
                    </div>

                    {showAdvanced && (
                        <div className="advanced-section" style={{
                            padding: '12px',
                            backgroundColor: 'rgba(255,255,255,0.03)',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.05)',
                            marginTop: '8px'
                        }}>
                            <div className="form-group">
                                <label className="form-label">
                                    <Box size={16} /> Docker Image
                                </label>
                                <input
                                    type="text"
                                    value={image}
                                    onChange={(e) => setImage(e.target.value)}
                                    className="form-input"
                                    placeholder="e.g. mcr.microsoft.com/playwright"
                                    style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="modal-footer">
                        <button type="button" onClick={onClose} className="btn btn-secondary">
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary">
                            <Play size={18} />
                            Launch Execution
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};