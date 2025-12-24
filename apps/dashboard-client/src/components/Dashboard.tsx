import { useState } from 'react';
import { useExecutions } from '../hooks/useExecutions';
import { StatsGrid } from './StatsGrid';
import { ExecutionRow } from './ExecutionRow';

export const Dashboard = () => {
    const { executions, loading, error } = useExecutions();
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

    const toggleRow = (id: string) => {
        setExpandedRowId(expandedRowId === id ? null : id);
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
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20 }}>Loading live data...</td></tr>}
                        
                        {executions.map((exec) => (
                            <ExecutionRow 
                                key={exec._id} 
                                execution={exec} 
                                isExpanded={expandedRowId === exec._id}
                                onToggle={() => toggleRow(exec._id)}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};