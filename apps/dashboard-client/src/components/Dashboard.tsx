import { useEffect, useState } from 'react';
import { useExecutions } from '../hooks/useExecutions';
import { StatsGrid } from './StatsGrid';
import { ExecutionRow } from './ExecutionRow';
import { ExecutionModal } from './ExecutionModal';
import { Play, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_URL = isProduction
    ? import.meta.env.VITE_API_URL || ''
    : 'http://localhost:3000';

export const Dashboard = () => {
    const { user, token, logout } = useAuth();
    const { executions, loading, error, setExecutions } = useExecutions();
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [availableFolders, setAvailableFolders] = useState<string[]>([]);
    const [defaults, setDefaults] = useState<any>(null);

    useEffect(() => {
        if (!token) return;

        fetch(`${API_URL}/api/tests-structure`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })
            .then(async res => {
                const contentType = res.headers.get('content-type');
                if (res.ok && contentType && contentType.includes('application/json')) {
                    return res.json();
                }
                return [];
            })
            .then(data => setAvailableFolders(Array.isArray(data) ? data : []))
            .catch(() => {
                console.warn('Using decoupled mode (local folders not found)');
                setAvailableFolders([]);
            });
    }, [token]);

    useEffect(() => {
        if (!token) return;

        fetch(`${API_URL}/config/defaults`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })
            .then(res => res.json())
            .then(data => setDefaults(data))
            .catch(() => console.warn('Using hardcoded defaults'));
    }, [token]);

    const toggleRow = (id: string) => {
        setExpandedRowId(expandedRowId === id ? null : id);
    };

    const handleRunTest = async (formData: {
        folder: string;
        environment: string;
        baseUrl: string;
        image: string;
        command: string;
    }) => {
        try {
            const payload = {
                taskId: `run-${Date.now()}`,
                image: formData.image,
                command: formData.command,
                folder: formData.folder,
                tests: [formData.folder],
                config: {
                    environment: formData.environment,
                    baseUrl: formData.baseUrl,
                    retryAttempts: 2
                }
            };

            const response = await fetch(`${API_URL}/api/execution-request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Server validation failed');
            }

            const data = await response.json();
            console.log('Job Queued:', data.taskId);
            setIsModalOpen(false);

        } catch (err: any) {
            console.error('Run test failed:', err);
            alert(`Error launching test: ${err.message}`);
        }
    };

    const handleDelete = async (taskId: string) => {
        if (!window.confirm('Delete this execution?')) return;
        try {
            await fetch(`${API_URL}/api/executions/${taskId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            setExecutions((old) => old.filter((exec) => exec.taskId !== taskId));
        } catch (err) {
            alert('Delete failed');
        }
    };

    if (error) return <div style={{ color: '#ef4444', padding: '20px' }}>Error: {error}</div>;

    return (
        <div className="container">
            {/* Header with Auth Info */}
            <div style={{
                backgroundColor: 'white',
                borderBottom: '1px solid #e2e8f0', // slate-200
                padding: '0 24px',
                height: '64px',
                marginBottom: '24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
            }}>
                {/* Left side - Logo and Organization */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        backgroundColor: '#2563eb', // blue-600
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '14px'
                    }}>
                        AAC
                    </div>
                    
                    <div style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0' }}></div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ 
                            fontSize: '14px', 
                            fontWeight: '600', 
                            color: '#1e293b' // slate-800
                        }}>
                            {user?.organizationName}
                        </span>
                        <span style={{ 
                            fontSize: '11px', 
                            color: '#64748b', // slate-500
                            textTransform: 'uppercase',
                            fontWeight: '600',
                            letterSpacing: '0.05em'
                        }}>
                            Organization
                        </span>
                    </div>
                </div>

                {/* Right side - User info and logout */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    {/* User Profile */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ 
                                fontSize: '14px', 
                                fontWeight: '500', 
                                color: '#334155' // slate-700
                            }}>
                                {user?.name}
                            </div>
                            <div style={{ 
                                fontSize: '12px', 
                                color: '#94a3b8' // slate-400
                            }}>
                                {user?.email}
                            </div>
                        </div>
                        
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            backgroundColor: '#f1f5f9', // slate-100
                            color: '#475569', // slate-600
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '600',
                            border: '1px solid #e2e8f0'
                        }}>
                            {user?.name?.charAt(0).toUpperCase()}
                        </div>
                    </div>

                    {/* Role Badge */}
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 12px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        backgroundColor: '#eff6ff', // blue-50
                        color: '#2563eb', // blue-600
                        border: '1px solid #dbeafe'
                    }}>
                        {user?.role}
                    </span>

                    {/* Logout Button */}
                    <button
                        onClick={logout}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '13px',
                            color: '#ef4444', // red-500
                            fontWeight: '500',
                            backgroundColor: 'white',
                            border: '1px solid #fee2e2', // red-100
                            cursor: 'pointer',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            transition: 'all 0.2s ease',
                            height: '32px'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = '#fef2f2';
                            e.currentTarget.style.borderColor = '#fecaca';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = 'white';
                            e.currentTarget.style.borderColor = '#fee2e2';
                        }}
                    >
                        <LogOut size={14} />
                        Logout
                    </button>
                </div>
            </div>

            {/* Main Header with Title and Run Test Button */}
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
                defaults={defaults}
            />

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th>Source</th>
                            <th>Task ID</th>
                            <th>Environment</th>
                            <th>Start Time</th>
                            <th>Duration</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && executions.length === 0 && (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading live data...</td></tr>
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