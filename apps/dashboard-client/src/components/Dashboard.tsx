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
                    environment: formData.environment.toLowerCase(),
                    baseUrl: formData.baseUrl,
                    retryAttempts: 2
                }
            };

            const response = await fetch(`${API_URL}/execution-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) throw new Error('Failed to trigger execution');
            
            console.log('✅ Execution triggered successfully:', payload.taskId);
            setIsModalOpen(false);

        } catch (err) {
            console.error('Run test failed:', err);
            alert('Error launching test');
        }
    };

    const handleDelete = async (taskId: string) => {
        if (!window.confirm('Are you sure you want to delete this execution history?')) return;

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

    if (error) return <div className="p-5 text-red-500">Error: {error}</div>;

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100">Automation Center</h1>
                    <p className="text-slate-400 mt-1">Live monitoring of test infrastructure</p>
                </div>
                
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-lg shadow-blue-900/20"
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

            <div className="bg-slate-800 rounded-xl shadow-xl overflow-hidden border border-slate-700">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-900/50 text-slate-400 text-sm uppercase tracking-wider">
                            <tr>
                                <th className="p-4 font-semibold">Status</th>
                                <th className="p-4 font-semibold">Task ID</th>
                                <th className="p-4 font-semibold">Environment</th>
                                <th className="p-4 font-semibold">Start Time</th>
                                <th className="p-4 font-semibold">Duration</th>
                                <th className="p-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {loading && executions.length === 0 && (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Loading live data...</td></tr>
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
        </div>
    );
};