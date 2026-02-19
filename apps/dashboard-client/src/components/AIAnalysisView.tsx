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
        if (!analysis) {
            return (
                <div style={{ color: '#6b7280', fontStyle: 'italic', padding: '16px', textAlign: 'center' }}>
                    No analysis content available.
                </div>
            );
        }

        return analysis.split('\n').map((line, i) => {
            if (line.startsWith('## ')) {
                const title = line.replace('## ', '').replace(/\*\*/g, '');
                const isRootCause = title.toLowerCase().includes('root cause');
                const isFix = title.toLowerCase().includes('fix') || title.toLowerCase().includes('solution');

                return (
                    <div key={i} style={{ marginTop: '24px', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                        <h3 style={{
                            fontSize: '18px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: isRootCause ? '#dc2626' : isFix ? '#16a34a' : '#1e293b'
                        }}>
                            {isRootCause && <AlertTriangle size={18} style={{ color: '#f87171' }} />}
                            {isFix && <Sparkles size={18} style={{ color: '#4ade80' }} />}
                            {title}
                        </h3>
                    </div>
                );
            }

            if (line.trim().startsWith('* ')) {
                return (
                    <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '8px', paddingLeft: '8px' }}>
                        <div style={{
                            marginTop: '8px',
                            minWidth: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: '#3b82f6'
                        }}></div>
                        <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.625' }}>
                            {line.replace('* ', '').replace(/\*\*/g, '')}
                        </p>
                    </div>
                );
            }

            if (line.includes('**')) {
                const parts = line.split('**');
                return (
                    <p key={i} style={{ color: '#64748b', marginBottom: '12px', fontSize: '14px', lineHeight: '1.625' }}>
                        {parts.map((part, index) =>
                            index % 2 === 1 ? (
                                <span key={index} style={{
                                    color: '#1e293b',
                                    fontWeight: 600,
                                    backgroundColor: 'rgba(0, 0, 0, 0.07)',
                                    padding: '0 4px',
                                    borderRadius: '4px'
                                }}>
                                    {part}
                                </span>
                            ) : part
                        )}
                    </p>
                );
            }

            if (line.trim() === '') return <div key={i} style={{ height: '8px' }}></div>;
            return <p key={i} style={{ color: '#64748b', marginBottom: '12px', fontSize: '14px', lineHeight: '1.625' }}>{line}</p>;
        });
    }, [analysis]);

    if (!isVisible) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '85vh' }}>
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-lg ${status === 'UNSTABLE' ? 'bg-amber-100 text-amber-400' : 'bg-rose-100 text-rose-400'}`}>
                            <Bot size={22} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800 m-0 flex items-center gap-2">
                                AI Root Cause Analysis
                                <Sparkles size={15} className="text-blue-400 animate-pulse" />
                            </h3>
                            <p className="text-xs text-slate-400 m-0">Powered by Gemini 2.5 Flash</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full p-1.5 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body (Scrollable) */}
                <div className="modal-body" style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '20px',
                    backgroundColor: '#ffffff',
                    fontSize: '0.9rem'
                }}>
                    {formattedContent}
                </div>

                {/* Footer */}
                <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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