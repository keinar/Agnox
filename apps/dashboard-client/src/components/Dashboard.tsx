import { useState } from 'react';
import { useExecutions } from '../hooks/useExecutions';
import { StatsGrid } from './StatsGrid';
import { ExecutionRow } from './ExecutionRow';

export const Dashboard = () => {
    const { executions, loading, error, refetch } = useExecutions();
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

    const toggleRow = (id: string) => {
        setExpandedRowId(expandedRowId === id ? null : id);
    };

    const handleDelete = async (taskId: string) => {
        try {
            const response = await fetch(`http://localhost:3000/executions/${taskId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                await refetch();
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
            <div className="header">
                <div className="title">
                    <h1>Automation Center</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Live monitoring of test infrastructure</p>
                </div>
            </div>

            <StatsGrid executions={executions} />

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
                                key={exec._id} 
                                execution={exec} 
                                isExpanded={expandedRowId === exec._id}
                                onToggle={() => toggleRow(exec._id)}
                                onDelete={handleDelete}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};