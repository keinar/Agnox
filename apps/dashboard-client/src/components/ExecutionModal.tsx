import React, { useState } from 'react';
import { X, Play } from 'lucide-react';

interface ExecutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: { folder: string; environment: string; baseUrl: string }) => void;
    availableFolders: string[];
}

export const ExecutionModal: React.FC<ExecutionModalProps> = ({ isOpen, onClose, onSubmit, availableFolders }) => {
    const [environment, setEnvironment] = useState('DEV');
    const [baseUrl, setBaseUrl] = useState('https://photo-gallery.keinar.com/');
    const [selectedFolder, setSelectedFolder] = useState('all');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ folder: selectedFolder, environment, baseUrl });
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-900/50">
                    <h3 className="text-lg font-semibold text-white">Run New Test</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Test Suite</label>
                        <select 
                            value={selectedFolder}
                            onChange={(e) => setSelectedFolder(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="all">🚀 Run All Tests (Full Suite)</option>
                            {availableFolders.map(folder => (
                                <option key={folder} value={folder}>📂 {folder.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Environment</label>
                        <select 
                            value={environment}
                            onChange={(e) => setEnvironment(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="DEV">Development (DEV)</option>
                            <option value="STAGING">Staging</option>
                            <option value="PROD">Production</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Base URL</label>
                        <input 
                            type="text" 
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center gap-2 shadow-lg shadow-blue-900/20"
                        >
                            <Play size={16} /> Launch Test
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};