import { useState } from 'react';
import { useExecutions } from '../hooks/useExecutions';
import { StatsGrid } from './StatsGrid';
import { ExecutionRow } from './ExecutionRow';
import { ExecutionModal } from './ExecutionModal';
import { Play } from 'lucide-react';

const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_URL = isProduction 
    ? 'https://api.automation.keinar.com' 
    : 'http://localhost:3000';

export const Dashboard = () => {
    const { executions, loading, error, setExecutions } = useExecutions();
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const toggleRow = (id: string) => {
        setExpandedRowId(expandedRowId === id ? null : id);
    };

    const handleRunTest = async (payload: any) => {
        try {
            const response = await fetch(`${API_URL}/execution-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) throw new Error('Failed to trigger execution');
            
            console.log('✅ Execution triggered successfully:', payload.taskId);
        } catch (err) {
            console.error('Run test failed:', err);
            alert('Error launching test');
        }
    };

    const handleDelete = async (taskId: string) => {
        try {
            const response = await fetch(`${API_URL}/executions/${taskId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setExecutions((old) => old.filter((exec) => exec.taskId !== taskId));
            } else {
                const errData = await response.json();
                alert(`Error: ${errData.error || 'Failed to delete'}`);
            }
        } catch (err) {
            console.error('Delete failed:', err);
            alert('Server connection error');
        }
    };

    if (error) return <div style={{color: 'red', padding: 20}}>Error: {error}</div>;

    return (
        <div className="container">
            <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="title">
                    <h1>Automation Center</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Live monitoring of test infrastructure</p>
                </div>
                
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="run-btn"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: '#3b82f6',
                        padding: '10px 16px'
                    }}
                >
                    <Play size={16} /> Run New Test
                </button>
            </div>

            <StatsGrid executions={executions} />

            <ExecutionModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSubmit={handleRunTest} 
            />

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th>Task ID</th>
                            <th>Environment</th>
                            <th>Start Time</th>
                            <th>Duration</th>
                            <th style={{ textAlign: 'right', paddingRight: '20px' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && executions.length === 0 && (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20 }}>Loading live data...</td></tr>
                        )}
                        
                        {executions.map((exec) => (
                            <ExecutionRow 
                                key={exec._id || exec.taskId} 
                                execution={exec} 
                                isExpanded={expandedRowId === (exec._id || exec.taskId)}
                                onToggle={() => toggleRow(exec._id || exec.taskId)}
                                onDelete={handleDelete}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};