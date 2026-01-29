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
            <>
                <style>
                    {`
                    .dashboard-header {
                        background-color: white;
                        border-bottom: 1px solid #e2e8f0;
                        padding: 0 24px;
                        height: 72px;
                        margin-bottom: 24px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
                    }
                    
                    .header-left {
                        display: flex;
                        align-items: center;
                        gap: 16px;
                    }

                    .header-right {
                        display: flex;
                        align-items: center;
                        gap: 20px;
                    }

                    .user-details {
                        text-align: right;
                        display: block;
                    }

                    .divider {
                        height: 24px;
                        width: 1px;
                        background-color: #e2e8f0;
                        display: block;
                    }

                    @media (max-width: 768px) {
                        .dashboard-header {
                            height: auto;
                            flex-direction: column;
                            padding: 16px;
                            gap: 16px;
                            align-items: stretch;
                        }

                        .header-left {
                            justify-content: space-between;
                            width: 100%;
                            border-bottom: 1px solid #f1f5f9;
                            padding-bottom: 12px;
                        }

                        .header-right {
                            justify-content: space-between;
                            width: 100%;
                            gap: 12px;
                        }

                        .user-details {
                            text-align: left;
                            display: flex;
                            flex-direction: column;
                        }

                        .divider {
                            display: none;
                        }
                    }
                    `}
                </style>

                <div className="dashboard-header">
                    {/* Left side - Logo and Organization */}
                    <div className="header-left">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '36px',
                                height: '36px',
                                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: '800',
                                fontSize: '14px',
                                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                            }}>
                                AAC
                            </div>
                            <div className="divider"></div>
                            <div>
                                <h2 style={{ 
                                    fontSize: '15px', 
                                    fontWeight: '600', 
                                    color: '#1e293b', 
                                    margin: 0,
                                    lineHeight: '1.2'
                                }}>
                                    {user?.organizationName}
                                </h2>
                                <span style={{ 
                                    fontSize: '11px', 
                                    color: '#64748b', 
                                    textTransform: 'uppercase', 
                                    fontWeight: '600', 
                                    letterSpacing: '0.05em' 
                                }}>
                                    Organization
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right side - User info and logout */}
                    <div className="header-right">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                backgroundColor: '#f1f5f9',
                                border: '2px solid #fff',
                                boxShadow: '0 0 0 1px #e2e8f0',
                                color: '#475569',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: '600',
                                fontSize: '16px'
                            }}>
                                {user?.name?.charAt(0).toUpperCase()}
                            </div>
                            
                            <div className="user-details">
                                <div style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                                    {user?.name}
                                </div>
                                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                                    {user?.email}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '700',
                                textTransform: 'uppercase',
                                backgroundColor: '#eff6ff',
                                color: '#2563eb',
                                border: '1px solid #dbeafe',
                                letterSpacing: '0.025em'
                            }}>
                                {user?.role}
                            </span>

                            <button
                                onClick={logout}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    fontSize: '13px',
                                    color: '#ef4444',
                                    fontWeight: '500',
                                    backgroundColor: 'white',
                                    border: '1px solid #fee2e2',
                                    cursor: 'pointer',
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    transition: 'all 0.2s ease',
                                    height: '36px',
                                    whiteSpace: 'nowrap'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.backgroundColor = '#fef2f2';
                                    e.currentTarget.style.borderColor = '#fecaca';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(239, 68, 68, 0.1)';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.backgroundColor = 'white';
                                    e.currentTarget.style.borderColor = '#fee2e2';
                                    e.currentTarget.style.transform = 'none';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <LogOut size={16} />
                                <span className="logout-text">Logout</span>
                            </button>
                        </div>
                    </div>
                </div>
            </>
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