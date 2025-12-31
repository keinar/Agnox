import React from 'react';
import { Trash2, ChevronDown, ChevronRight, CheckCircle, XCircle, Clock, PlayCircle, FileText, BarChart2 } from 'lucide-react';
import { formatDistanceToNow, differenceInSeconds } from 'date-fns';

interface ExecutionRowProps {
    execution: any;
    isExpanded: boolean;
    onToggle: () => void;
    onDelete: (id: string) => void;
}

const formatDateSafe = (dateString: string | Date | undefined) => {
    if (!dateString) return '-';
    try { return new Date(dateString).toLocaleString(); } catch { return 'Invalid Date'; }
};

const formatTimeAgo = (dateString: string | Date | undefined) => {
    if (!dateString) return '';
    try { return formatDistanceToNow(new Date(dateString), { addSuffix: true }); } catch { return ''; }
};

const calculateDuration = (exec: any) => {
    if (exec.duration && exec.duration !== '-') return exec.duration;
    if (exec.startTime && exec.endTime) {
        try {
            const start = new Date(exec.startTime);
            const end = new Date(exec.endTime);
            const seconds = differenceInSeconds(end, start);
            if (seconds < 60) return `${seconds}s`;
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${minutes}m ${remainingSeconds}s`;
        } catch (e) { return '-'; }
    }
    if (exec.status === 'RUNNING' && exec.startTime) {
        try { return formatDistanceToNow(new Date(exec.startTime)).replace('about ', ''); } catch { return 'Running...'; }
    }
    return '-';
};

export const ExecutionRow: React.FC<ExecutionRowProps> = ({ execution, isExpanded, onToggle, onDelete }) => {
    const statusColors = { PASSED: 'passed', FAILED: 'failed', RUNNING: 'running', PENDING: 'running' };
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

    // Smart URL resolution
    const getBaseUrl = () => {
        // 1. Primary: Use what the Worker explicitly saved in DB
        if (execution.reportsBaseUrl) {
            return execution.reportsBaseUrl;
        }

        // 2. Fallback: Detection based on current hostname
        const isProductionDomain = window.location.hostname === 'automation.keinar.com';
        return isProductionDomain 
            ? 'https://api.automation.keinar.com' 
            : 'http://localhost:3000';
    };

    const baseUrl = getBaseUrl();
    const playwrightReportUrl = `${baseUrl}/reports/${execution.taskId}/playwright-report/index.html`;
    const allureReportUrl = `${baseUrl}/reports/${execution.taskId}/allure-report/index.html`;

    const isFinished = execution.status === 'PASSED' || execution.status === 'FAILED';

    let terminalContent = '';

    if (execution.error) {
        const errorMsg = typeof execution.error === 'object' 
            ? JSON.stringify(execution.error, null, 2) 
            : execution.error;
        
        terminalContent += `🛑 FAILURE DETAILS:\n${errorMsg}\n\n`;
        terminalContent += `──────────────────────────────────────────\n\n`;
    }

    const logs = execution.output || execution.logs;
    if (logs && logs.length > 0) {
        terminalContent += Array.isArray(logs) ? logs.join('\n') : logs;
    }

    if (!terminalContent) {
        terminalContent = 'Waiting for logs...';
    }

    return (
        <>
            <tr onClick={onToggle} className={isExpanded ? 'expanded-row' : ''}>
                <td>
                    <span className={`badge ${statusClass}`}>
                        {getStatusIcon(execution.status)} {execution.status}
                    </span>
                </td>
                <td style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>{execution.taskId}</td>
                <td>
                    <span style={{ background: '#334155', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', border: '1px solid #475569' }}>
                        {execution.config?.environment?.toUpperCase() || 'DEV'}
                    </span>
                </td>
                <td>
                    <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.9rem' }}>
                        <span>{formatDateSafe(execution.startTime)}</span>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {formatTimeAgo(execution.startTime)}
                        </span>
                    </div>
                </td>
                <td style={{ fontWeight: 500 }}>
                    {calculateDuration(execution)}
                </td>
                <td>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        
                        {isFinished && (
                            <>
                                <a 
                                    href={playwrightReportUrl} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    title="Playwright Report"
                                    className="icon-link blue"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <FileText size={18} />
                                </a>
                                <a 
                                    href={allureReportUrl} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    title="Allure Dashboard"
                                    className="icon-link green"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <BarChart2 size={18} />
                                </a>
                            </>
                        )}

                        <button 
                            className="icon-btn red"
                            title="Delete Execution"
                            onClick={(e) => { e.stopPropagation(); onDelete(execution.taskId); }}
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
                            <div className="details-grid">
                                <div className="detail-item">
                                    <label>Base URL</label>
                                    <span>{execution.config?.baseUrl}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Tests Path</label>
                                    <span>{execution.tests?.join(', ') || 'All'}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Browser</label>
                                    <span>Chromium (Headless)</span>
                                </div>
                            </div>

                            <div className="terminal-window">
                                <div className="terminal-header">
                                    <div className="dot red"></div>
                                    <div className="dot yellow"></div>
                                    <div className="dot green"></div>
                                    <span className="terminal-title">console output</span>
                                </div>
                                <div className="terminal-body">
                                    {terminalContent}
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
};