import { format, intervalToDuration } from 'date-fns';
import { ChevronDown, ChevronUp, Trash2, FileText, BarChart2 } from 'lucide-react';
import type { Execution } from '../types';
import { StatusBadge } from './StatusBadge';
import { TerminalView } from './TerminalView';

interface Props {
    execution: Execution;
    isExpanded: boolean;
    onToggle: () => void;
    onDelete: (taskId: string) => void;
}

export const ExecutionRow = ({ execution, isExpanded, onToggle, onDelete }: Props) => {

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(`Are you sure you want to delete task ${execution.taskId}?`)) {
            onDelete(execution.taskId);
        }
    };

    const calculateDuration = (start: string, end?: string) => {
        if (!end) return 'Running...';
        const duration = intervalToDuration({
            start: new Date(start),
            end: new Date(end),
        });
        const parts = [];
        if (duration.minutes) parts.push(`${duration.minutes}m`);
        if (duration.seconds) parts.push(`${duration.seconds}s`);
        return parts.join(' ') || '< 1s';
    };

    return (
        <>
            <tr onClick={onToggle} style={{ cursor: 'pointer' }}>
                <td><StatusBadge status={execution.status} /></td>
                <td style={{ fontFamily: 'monospace', color: '#fff' }}>{execution.taskId}</td>
                <td>
                    <span style={{ padding: '4px 8px', background: '#334155', borderRadius: '4px', fontSize: '0.8rem' }}>
                        {execution.config?.environment?.toUpperCase() || 'DEV'}
                    </span>
                </td>
                <td>{format(new Date(execution.startTime), 'dd/MM/yy HH:mm')}</td>
                <td>{calculateDuration(execution.startTime, execution.endTime)}</td>
                <td style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'flex-end' }}>

                    {(execution.status === 'PASSED' || execution.status === 'FAILED') && (
                        <>
                            {/* Playwright Report */}
                            <a
                                href={`http://localhost:3000/reports/${execution.taskId}/index.html`}
                                target="_blank"
                                title="Playwright Report"
                                style={{ color: '#60a5fa' }}
                            >
                                <FileText size={18} />
                            </a>

                            {/* Allure Report */}
                            <a
                                href={`http://localhost:3000/reports/${execution.taskId}/allure-report/index.html`}
                                target="_blank"
                                title="Allure Dashboard"
                                style={{ color: '#10b981' }}
                            >
                                <BarChart2 size={18} />
                            </a>
                        </>
                    )}

                    <button
                        onClick={handleDelete}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                        title="Delete Execution"
                    >
                        <Trash2 size={18} />
                    </button>
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </td>
            </tr>

            {isExpanded && (
                <tr className="expanded-row">
                    <td colSpan={6} style={{ padding: 0 }}>
                        <div className="expanded-content">
                            <div className="info-grid">
                                <InfoItem label="Task ID" value={execution.taskId} />
                                <InfoItem label="Tests Path" value={execution.tests.join(', ')} />
                                <InfoItem label="Retries" value={execution.config?.retryAttempts?.toString()} />
                            </div>

                            <TerminalView output={execution.output} error={execution.error} />
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
};

const InfoItem = ({ label, value }: { label: string, value?: string }) => (
    <div className="info-item">
        <label>{label}</label>
        <span>{value || 'N/A'}</span>
    </div>
);