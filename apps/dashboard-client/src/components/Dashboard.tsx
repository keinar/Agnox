import { useEffect, useState } from 'react';
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
    
    const [availableFolders, setAvailableFolders] = useState<string[]>([]);

    useEffect(() => {
        fetch(`${API_URL}/tests-structure`)
            .then(res => res.json())
            .then(data => setAvailableFolders(data))
            .catch(err => console.error('Failed to fetch test folders', err));
    }, []);

    const toggleRow = (id: string) => {
        setExpandedRowId(expandedRowId === id ? null : id);
    };

    const handleRunTest = async (formData: { folder: string; environment: string; baseUrl: string }) => {
        try {
            let testsToRun: string[] = [];
            if (formData.folder === 'all') {
                testsToRun = ['tests'];
            } else {
                testsToRun = [`tests/${formData.folder}`];
            }

            const payload = {
                taskId: `run-${Date.now()}`,
                tests: testsToRun,
                config: {
                    environment: formData.environment,
                    baseUrl: formData.baseUrl,
                    retryAttempts: 2
                }
            };

            const response = await fetch(`${API_URL}/execution-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Server Error:', errorData);
                throw new Error(errorData.error || 'Server validation failed');
            }
            
            const data = await response.json();
            console.log('✅ Success:', data.taskId);
            setIsModalOpen(false);

        } catch (err: any) {
            console.error('Run test failed:', err);
            alert(`Error launching test: ${err.message}`);
        }
    };

    const handleDelete = async (taskId: string) => {
        if (!window.confirm('Delete this execution?')) return;
        try {
            await fetch(`${API_URL}/executions/${taskId}`, { method: 'DELETE' });
            setExecutions((old) => old.filter((exec) => exec.taskId !== taskId));
        } catch (err) {
            alert('Delete failed');
        }
    };

    if (error) return <div style={{ color: '#ef4444', padding: '20px' }}>Error: {error}</div>;

    return (
        <div className="container">
            <div className="header">
                <div className="title">
                    <h1>Automation Center</h1>
                    <p style={{ color: '#94a3b8', marginTop: '4px' }}>Live monitoring of test infrastructure</p>
                </div>
                
                <button 
                    onClick={() => setIsModalOpen(true)}
                    style={{
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.4)',
                        transition: 'transform 0.1s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
                >
                    <Play size={18} /> Run New Test
                </button>
            </div>

            <StatsGrid executions={executions} />

            <ExecutionModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSubmit={handleRunTest}
                availableFolders={availableFolders} 
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
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && executions.length === 0 && (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading live data...</td></tr>
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