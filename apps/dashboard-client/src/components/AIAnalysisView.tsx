import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Bot, Sparkles, AlertTriangle, CheckCircle } from 'lucide-react';

interface AIAnalysisViewProps {
    analysis: string | undefined;
    status: string;
    isVisible: boolean;
    onClose: () => void;
}

const AIAnalysisView: React.FC<AIAnalysisViewProps> = ({ 
    analysis, 
    status, 
    isVisible, 
    onClose 
}) => {
    
    const formattedContent = useMemo(() => {
        if (!analysis) return <div className="text-gray-500 italic p-4 text-center">No analysis content available.</div>;

        return analysis.split('\n').map((line, i) => {
            if (line.startsWith('## ')) {
                const title = line.replace('## ', '').replace(/\*\*/g, '');
                const isRootCause = title.toLowerCase().includes('root cause');
                const isFix = title.toLowerCase().includes('fix') || title.toLowerCase().includes('solution');
                
                return (
                    <div key={i} className="mt-6 mb-3 border-b border-gray-700 pb-2">
                        <h3 className="text-lg font-bold flex items-center gap-2" 
                            style={{ color: isRootCause ? '#fca5a5' : isFix ? '#86efac' : '#e2e8f0' }}>
                            {isRootCause && <AlertTriangle size={18} className="text-red-400" />}
                            {isFix && <Sparkles size={18} className="text-green-400" />}
                            {title}
                        </h3>
                    </div>
                );
            }
            
            if (line.trim().startsWith('* ')) {
                return (
                    <div key={i} className="flex gap-3 mb-2 pl-2">
                        <div className="mt-2 min-w-[6px] h-[6px] rounded-full bg-blue-500"></div>
                        <p className="text-gray-300 text-sm leading-relaxed">{line.replace('* ', '').replace(/\*\*/g, '')}</p>
                    </div>
                );
            }

            if (line.includes('**')) {
                const parts = line.split('**');
                return (
                    <p key={i} className="text-gray-300 mb-3 text-sm leading-relaxed">
                        {parts.map((part, index) => 
                            index % 2 === 1 ? <span key={index} className="text-white font-semibold bg-white/10 px-1 rounded">{part}</span> : part
                        )}
                    </p>
                );
            }

            if (line.trim() === '') return <div key={i} className="h-2"></div>;
            return <p key={i} className="text-gray-300 mb-3 text-sm leading-relaxed">{line}</p>;
        });
    }, [analysis]);

    if (!isVisible) return null;

    return createPortal(
        <div className="modal-overlay">
            <div className="modal-container" style={{ maxWidth: '800px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                
                {/* Header */}
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className={`p-2 rounded-lg ${status === 'UNSTABLE' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                            <Bot size={24} />
                        </div>
                        <div>
                            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                AI Root Cause Analysis
                                <Sparkles size={16} className="text-blue-400 animate-pulse" />
                            </h3>
                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>Powered by Gemini 2.5 Flash</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="close-button">
                        <X size={24} />
                    </button>
                </div>

                {/* Body (Scrollable) */}
                <div className="modal-body" style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    padding: '20px', 
                    backgroundColor: '#0f172a',
                    fontSize: '0.9rem' 
                }}>
                    {formattedContent}
                </div>

                {/* Footer */}
                <div className="modal-footer" style={{ borderTop: '1px solid #1e293b', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#64748b' }}>
                        <CheckCircle size={14} />
                        Generated automatically from logs
                    </div>
                    <button onClick={onClose} className="btn btn-primary" style={{ minWidth: '100px' }}>
                        Close Analysis
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AIAnalysisView;