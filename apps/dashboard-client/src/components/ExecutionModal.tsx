import React, { useState, useEffect } from 'react';
import { X, Play, Folder, Server, Globe, Box, Terminal, ChevronDown, ChevronRight } from 'lucide-react';

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
}

export const ExecutionModal: React.FC<ExecutionModalProps> = ({ isOpen, onClose, onSubmit, availableFolders }) => {
    const [environment, setEnvironment] = useState('development'); 
    const [baseUrl, setBaseUrl] = useState(import.meta.env.BASE_URL);
    const [selectedFolder, setSelectedFolder] = useState('all');
    const [showAdvanced, setShowAdvanced] = useState(false);
    
    // Agnostic defaults
    const [image, setImage] = useState('local-playwright-tests:latest');
    const [command, setCommand] = useState('npx playwright test; npx allure generate allure-results --clean -o allure-report');

    // Update command automatically when folder changes
    useEffect(() => {
        const allureCommand = 'npx allure generate allure-results --clean -o allure-report';
        
        if (selectedFolder === 'all') {
            setCommand(`npx playwright test; ${allureCommand}`);
        } else {
            setCommand(`npx playwright test tests/${selectedFolder}; ${allureCommand}`);
        }
    }, [selectedFolder]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ 
            folder: selectedFolder, 
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
                            <Folder size={16} /> Test Suite
                        </label>
                        <select 
                            value={selectedFolder}
                            onChange={(e) => setSelectedFolder(e.target.value)}
                            className="form-select"
                        >
                            <option value="all">🚀 Run All Tests (Full Suite)</option>
                            <option disabled>──────────</option>
                            {availableFolders.map(folder => (
                                <option key={folder} value={folder}>
                                    📂 {folder.toUpperCase()}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">
                            <Server size={16} /> Environment
                        </label>
                        <select 
                            value={environment}
                            onChange={(e) => setEnvironment(e.target.value)}
                            className="form-select"
                        >
                            <option value="development">🚧 Development (DEV)</option>
                            <option value="staging">👀 Staging</option>
                            <option value="production">🔥 Production</option>
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
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">
                                    <Terminal size={16} /> Shell Command
                                </label>
                                <input 
                                    type="text"
                                    value={command}
                                    onChange={(e) => setCommand(e.target.value)}
                                    className="form-input"
                                    placeholder="e.g. pytest"
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