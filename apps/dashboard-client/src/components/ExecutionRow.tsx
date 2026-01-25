import React from 'react';
import { 
    Trash2, ChevronDown, ChevronRight, CheckCircle, XCircle, 
    Clock, PlayCircle, FileText, BarChart2, Laptop, Server, 
    Turtle, Zap, Box, Sparkles, Loader2, AlertTriangle
} from 'lucide-react';
import { formatDistanceToNow, differenceInSeconds } from 'date-fns';
import AIAnalysisView from './AIAnalysisView';

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
    if ((exec.status === 'RUNNING' || exec.status === 'ANALYZING') && exec.startTime) {
        try { return formatDistanceToNow(new Date(exec.startTime)).replace('about ', ''); } catch { return 'Running...'; }
    }
    return '-';
};

export const ExecutionRow: React.FC<ExecutionRowProps> = ({ execution, isExpanded, onToggle, onDelete }) => {
    const [metrics, setMetrics] = React.useState<any>(null);
    const [showAI, setShowAI] = React.useState(false);

    React.useEffect(() => {
        const isFinished = ['PASSED', 'FAILED', 'UNSTABLE'].includes(execution.status);
        if (isFinished && execution.image) {
            const isProd = window.location.hostname.includes('.com');
            const API_URL = isProd ? import.meta.env.VITE_API_URL : 'http://localhost:3000';
            
            setTimeout(() => {
                fetch(`${API_URL}/metrics/${encodeURIComponent(execution.image)}`)
                    .then(res => res.json())
                    .then(data => setMetrics(data))
                    .catch(err => console.error("Metrics fetch failed", err));
            }, 500);
        }
    }, [execution.status, execution.image]);

    const renderPerformanceInsight = () => {
        if (!metrics || metrics.status === 'NO_DATA') return null;
        const avg = (metrics.averageDuration / 1000).toFixed(1);

        if (metrics.isRegression) {
            return <div title={`Slower than average (${avg}s)`} className="flex items-center text-amber-500 ml-1.5"><Turtle size={14} /></div>;
        }
        if (metrics.lastRunDuration < metrics.averageDuration * 0.8) {
            return <div title={`Faster than average (${avg}s)`} className="flex items-center text-emerald-500 ml-1.5"><Zap size={14} /></div>;
        }
        return null;
    };

    const statusColors = { 
        PASSED: 'passed', 
        FAILED: 'failed', 
        RUNNING: 'running', 
        PENDING: 'running',
        ANALYZING: 'running', // Visualy similar to running but with different icon
        UNSTABLE: 'warning'
    };
    
    const statusClass = statusColors[execution.status as keyof typeof statusColors] || '';

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'PASSED': return <CheckCircle size={16} />;
            case 'FAILED': return <XCircle size={16} />;
            case 'UNSTABLE': return <AlertTriangle size={16} className="text-yellow-500" />;
            case 'ANALYZING': return <Sparkles size={16} className="animate-pulse text-purple-400" />;
            case 'RUNNING': return <PlayCircle size={16} className="animate-spin-slow" />;
            case 'PENDING': return <Clock size={16} className="animate-pulse" />;
            default: return <Clock size={16} />;
        }
    };

    const getBaseUrl = () => {
        if (execution.reportsBaseUrl) return execution.reportsBaseUrl.replace(/\/$/, '');
        const envBaseUrl = import.meta.env.VITE_API_URL;
        if (envBaseUrl) return envBaseUrl.replace(/\/$/, '');
        return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000' : `https://api.${window.location.hostname}`;
    };

    const baseUrl = getBaseUrl();
    const htmlReportUrl = `${baseUrl}/reports/${execution.taskId}/native-report/index.html`;
    const allureReportUrl = `${baseUrl}/reports/${execution.taskId}/allure-report/index.html`;

    const isFinished = ['PASSED', 'FAILED', 'UNSTABLE'].includes(execution.status);
    const isRunLocal = execution.reportsBaseUrl?.includes('localhost') || execution.reportsBaseUrl?.includes('127.0.0.1');
    const isDashboardCloud = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    const areReportsInaccessible = isDashboardCloud && isRunLocal;

    let terminalContent = '';
    if (execution.error) {
        const errorMsg = typeof execution.error === 'object' ? JSON.stringify(execution.error, null, 2) : execution.error;
        terminalContent += `🛑 FAILURE DETAILS:\n${errorMsg}\n\n──────────────────────────────────────────\n\n`;
    }
    const logs = execution.output || execution.logs;
    if (logs && logs.length > 0) terminalContent += Array.isArray(logs) ? logs.join('\n') : logs;
    if (!terminalContent) terminalContent = 'Waiting for logs...';

    return (
        <>
            <tr onClick={onToggle} className={isExpanded ? 'expanded-row' : ''}>
                <td>
                    <span className={`badge ${statusClass}`}>
                        {getStatusIcon(execution.status)} {execution.status}
                    </span>
                </td>
                <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '6px',
                            fontSize: '0.7rem', fontWeight: 600,
                            backgroundColor: isRunLocal ? 'rgba(56, 189, 248, 0.1)' : 'rgba(168, 85, 247, 0.1)',
                            color: isRunLocal ? '#38bdf8' : '#a855f7',
                            border: `1px solid ${isRunLocal ? 'rgba(56, 189, 248, 0.2)' : 'rgba(168, 85, 247, 0.2)'}`
                        }}>
                            {isRunLocal ? <Laptop size={12} /> : <Server size={12} />}
                            {isRunLocal ? 'LOCAL' : 'CLOUD'}
                            {renderPerformanceInsight()}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Box size={10} />
                            <span style={{ fontFamily: 'monospace' }}>{execution.image?.split('/').pop() || 'container'}</span>
                        </div>
                    </div>
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
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{formatTimeAgo(execution.startTime)}</span>
                    </div>
                </td>
                <td style={{ fontWeight: 500 }}>{calculateDuration(execution)}</td>
                <td>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        
                        {/* 🌟 AI Analysis Icon Button 🌟 */}
                        {(execution.status === 'FAILED' || execution.status === 'UNSTABLE') && execution.analysis && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowAI(true); }}
                                title="View AI Root Cause Analysis"
                                className="icon-link"
                                style={{ color: '#a78bfa', backgroundColor: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)' }}
                            >
                                <Sparkles size={18} />
                            </button>
                        )}

                        {execution.status === 'ANALYZING' && (
                            <div title="AI Analysis in progress..." className="flex items-center gap-2 px-3 py-1 bg-purple-500/10 text-purple-400 rounded-full border border-purple-500/20 text-xs">
                                <Loader2 size={14} className="animate-spin" />
                                <span>Analyzing...</span>
                            </div>
                        )}

                        {isFinished && (
                            <>
                                {areReportsInaccessible ? (
                                    <span title="Reports available locally" style={{ fontSize: '0.65rem', color: '#64748b', backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', cursor: 'help' }}>
                                        Local Reports
                                    </span>
                                ) : (
                                    <>
                                        <a href={htmlReportUrl} target="_blank" rel="noreferrer" title="HTML Report" className="icon-link blue" onClick={(e) => e.stopPropagation()}>
                                            <FileText size={18} />
                                        </a>
                                        <a href={allureReportUrl} target="_blank" rel="noreferrer" title="Allure Report" className="icon-link green" onClick={(e) => e.stopPropagation()}>
                                            <BarChart2 size={18} />
                                        </a>
                                    </>
                                )}
                            </>
                        )}

                        <button className="icon-btn red" title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(execution.taskId); }}>
                            <Trash2 size={18} />
                        </button>
                        {isExpanded ? <ChevronDown size={18} color="#94a3b8" /> : <ChevronRight size={18} color="#94a3b8" />}
                    </div>
                </td>
            </tr>

            {isExpanded && (
                <tr>
                    <td colSpan={7} style={{ padding: 0 }}>
                        <div className="expanded-content">
                            <div className="details-grid">
                                <div className="detail-item"><label>Docker Image</label><span style={{ fontFamily: 'monospace', color: '#a5b4fc' }}>{execution.image || 'N/A'}</span></div>
                                <div className="detail-item"><label>Command</label><span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{execution.command || 'N/A'}</span></div>
                                <div className="detail-item"><label>Base URL</label><span>{execution.config?.baseUrl}</span></div>
                                <div className="detail-item"><label>Tests Path</label><span>{execution.tests?.join(', ') || 'All'}</span></div>
                                <div className="detail-item"><label>Run Origin</label><span>{execution.reportsBaseUrl || 'Unknown'}</span></div>
                                {metrics && (
                                    <div className="detail-item"><label>Avg. Duration</label><span style={{ color: metrics.isRegression ? '#f59e0b' : '#10b981', fontWeight: 'bold' }}>{(metrics.averageDuration / 1000).toFixed(2)}s</span></div>
                                )}
                            </div>
                            <div className="terminal-window">
                                <div className="terminal-header">
                                    <div className="dot red"></div><div className="dot yellow"></div><div className="dot green"></div>
                                    <span className="terminal-title">console output</span>
                                </div>
                                <div className="terminal-body">{terminalContent}</div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}

            <AIAnalysisView 
                analysis={execution.analysis} 
                status={execution.status}
                isVisible={showAI} 
                onClose={() => setShowAI(false)} 
            />
        </>
    );
};