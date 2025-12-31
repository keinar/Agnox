import React from 'react';
import { Trash2, ExternalLink, ChevronDown, ChevronRight, CheckCircle, XCircle, Clock, PlayCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ExecutionRowProps {
    execution: any;
    isExpanded: boolean;
    onToggle: () => void;
    onDelete: (id: string) => void;
}

const formatDateSafe = (dateString: string | Date | undefined) => {
    if (!dateString) return '-';
    try {
        return new Date(dateString).toLocaleString();
    } catch (e) {
        return 'Invalid Date';
    }
};

const formatDurationSafe = (dateString: string | Date | undefined) => {
    if (!dateString) return '';
    try {
        return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (e) {
        return '';
    }
};

export const ExecutionRow: React.FC<ExecutionRowProps> = ({ execution, isExpanded, onToggle, onDelete }) => {
    const statusColors = {
        PASSED: 'passed',
        FAILED: 'failed',
        RUNNING: 'running',
        PENDING: 'running'
    };
    
    const statusClass = statusColors[execution.status as keyof typeof statusColors] || '';

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'PASSED': return <CheckCircle size={16} />;
            case 'FAILED': return <XCircle size={16} />;
            case 'RUNNING': return <PlayCircle size={16} className="animate-spin-slow" />;
            case 'PENDING': return <Clock size={16} className="animate-pulse" />;
            default: return <Clock size={16} />;
        }
    };

    return (
        <>
            <tr onClick={onToggle} className={isExpanded ? 'expanded-row' : ''}>
                <td>
                    <span className={`badge ${statusClass}`}>
                        {getStatusIcon(execution.status)}
                        {execution.status}
                    </span>
                </td>
                <td style={{ fontFamily: 'monospace' }}>{execution.taskId}</td>
                <td>
                    <span style={{ 
                        background: '#334155', 
                        padding: '2px 8px', 
                        borderRadius: '4px', 
                        fontSize: '0.8rem',
                        border: '1px solid #475569'
                    }}>
                        {execution.config?.environment?.toUpperCase() || 'DEV'}
                    </span>
                </td>
                
                <td>
                    <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.9rem' }}>
                        <span>{formatDateSafe(execution.startTime)}</span>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {formatDurationSafe(execution.startTime)}
                        </span>
                    </div>
                </td>

                <td>{execution.duration || '-'}</td>
                
                <td>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button 
                            className="btn-icon"
                            onClick={(e) => { e.stopPropagation(); onDelete(execution.taskId); }}
                            style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                            <Trash2 size={18} />
                        </button>
                        {isExpanded ? <ChevronDown size={18} color="#94a3b8" /> : <ChevronRight size={18} color="#94a3b8" />}
                    </div>
                </td>
            </tr>
            
            {isExpanded && (
                <tr>
                    <td colSpan={6} style={{ padding: 0 }}>
                        <div className="expanded-content">
                            <div className="info-grid">
                                <div className="info-item">
                                    <label>Base URL</label>
                                    <span>{execution.config?.baseUrl}</span>
                                </div>
                                <div className="info-item">
                                    <label>Tests</label>
                                    <span>{execution.tests?.join(', ') || 'All'}</span>
                                </div>
                                <div className="info-item">
                                    <label>Browser</label>
                                    <span>Chromium (Headless)</span>
                                </div>
                            </div>

                            {/* Reports Links */}
                            <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
                                <a 
                                    href={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/reports/${execution.taskId}/playwright-report/index.html`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="btn btn-secondary"
                                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <ExternalLink size={16} /> Open Playwright Report
                                </a>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
};