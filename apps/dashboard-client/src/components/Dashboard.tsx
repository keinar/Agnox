import { useEffect, useState } from 'react';
import { useExecutions } from '../hooks/useExecutions';
import { StatsGrid } from './StatsGrid';
import { ExecutionRow } from './ExecutionRow';
import { ExecutionModal } from './ExecutionModal';
import { Play, LogOut, Menu, X, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
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
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
                        background: linear-gradient(to right, #ffffff, #f8fafc);
                        border-bottom: 1px solid #e2e8f0;
                        padding: 0 24px;
                        height: 72px;
                        margin-bottom: 24px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
                        border-radius: 10px;
                        position: sticky;
                        top: 0;
                        z-index: 100;
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

                    .user-section {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }

                    .user-details {
                        text-align: right;
                        display: flex;
                        flex-direction: column;
                    }

                    .divider {
                        height: 32px;
                        width: 1px;
                        background: linear-gradient(to bottom, transparent, #e2e8f0, transparent);
                        display: block;
                    }

                    .org-info {
                        display: flex;
                        flex-direction: column;
                        gap: 2px;
                    }

                    .role-badge {
                        padding: 5px 12px;
                        border-radius: 6px;
                        font-size: 11px;
                        font-weight: 700;
                        text-transform: uppercase;
                        background: linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%);
                        color: #667eea;
                        border: 1px solid #c7d2fe;
                        letter-spacing: 0.03em;
                    }

                    .logout-btn {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                        font-size: 13px;
                        color: #64748b;
                        font-weight: 500;
                        background-color: #f8fafc;
                        border: 1px solid #e2e8f0;
                        cursor: pointer;
                        padding: 8px 16px;
                        border-radius: 8px;
                        transition: all 0.2s ease;
                        height: 38px;
                        white-space: nowrap;
                    }

                    .logout-btn:hover {
                        background-color: #fef2f2;
                        border-color: #fecaca;
                        color: #ef4444;
                        transform: translateY(-1px);
                        box-shadow: 0 2px 8px rgba(239, 68, 68, 0.15);
                    }

                    .mobile-menu-btn {
                        display: none;
                        align-items: center;
                        justify-content: center;
                        width: 42px;
                        height: 42px;
                        border-radius: 10px;
                        background-color: #f8fafc;
                        border: 1px solid #e2e8f0;
                        cursor: pointer;
                        color: #64748b;
                        transition: all 0.2s ease;
                    }

                    .mobile-menu-btn:hover {
                        background-color: #f1f5f9;
                        color: #475569;
                    }

                    .mobile-dropdown {
                        display: none;
                        position: absolute;
                        top: 80px;
                        left: 20px;
                        right: 20px;
                        background: linear-gradient(to bottom, #ffffff, #f8fafc);
                        border-bottom: 1px solid #e2e8f0;
                        border-radius: 0 0 10px 10px;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                        padding: 20px 24px;
                        flex-direction: column;
                        gap: 16px;
                        z-index: 99;
                        animation: slideDown 0.2s ease;
                    }

                    @keyframes slideDown {
                        from {
                            opacity: 0;
                            transform: translateY(-10px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }

                    .mobile-dropdown.open {
                        display: flex;
                    }

                    .mobile-user-card {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 14px;
                        background-color: #ffffff;
                        border-radius: 12px;
                        border: 1px solid #e2e8f0;
                        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
                    }

                    .mobile-logout-btn {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                        font-size: 14px;
                        color: #ef4444;
                        font-weight: 600;
                        background-color: #fef2f2;
                        border: 1px solid #fecaca;
                        cursor: pointer;
                        padding: 14px 16px;
                        border-radius: 10px;
                        transition: all 0.2s ease;
                        width: 100%;
                    }

                    .mobile-logout-btn:hover {
                        background-color: #fee2e2;
                        transform: translateY(-1px);
                    }

                    @media (max-width: 768px) {
                        .dashboard-header {
                            height: 64px;
                            padding: 0 16px;
                            border-radius: 10px 10px 0 0;
                        }

                        .header-right {
                            display: none;
                        }

                        .org-info {
                            display: none;
                        }

                        .divider {
                            display: none;
                        }

                        .mobile-menu-btn {
                            display: flex;
                        }
                    }

                    @media (min-width: 769px) {
                        .mobile-dropdown {
                            display: none !important;
                        }
                    }
                    `}
                </style>

                <div className="dashboard-header">
                    {/* Left side - Logo and Organization */}
                    <div className="header-left">
                        <div style={{
                            width: '42px',
                            height: '42px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 800,
                            fontSize: '14px',
                            letterSpacing: '-0.5px',
                            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.35)',
                            flexShrink: 0
                        }}>
                            AAC
                        </div>
                        
                        <div className="divider"></div>
                        
                        <div className="org-info">
                            <h2 style={{ 
                                fontSize: '15px', 
                                fontWeight: 600, 
                                color: '#1e293b', 
                                margin: 0,
                                lineHeight: 1.3,
                                maxWidth: '200px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}>
                                {user?.organizationName || 'Organization'}
                            </h2>
                            <span style={{ 
                                fontSize: '11px', 
                                color: '#94a3b8', 
                                textTransform: 'uppercase', 
                                fontWeight: 600, 
                                letterSpacing: '0.05em' 
                            }}>
                                Organization
                            </span>
                        </div>
                    </div>

                    {/* Right side - Desktop */}
                    <div className="header-right">
                        <Link
                            to="/settings"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 16px',
                                fontSize: '14px',
                                fontWeight: 500,
                                color: '#64748b',
                                textDecoration: 'none',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                transition: 'all 0.2s ease',
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.background = '#f1f5f9';
                                e.currentTarget.style.color = '#475569';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.background = '#f8fafc';
                                e.currentTarget.style.color = '#64748b';
                            }}
                        >
                            <Settings size={18} />
                            Settings
                        </Link>

                        <div className="user-section">
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%)',
                                border: '2px solid #ffffff',
                                boxShadow: '0 0 0 1px #e0e7ff',
                                color: '#667eea',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '16px',
                                flexShrink: 0
                            }}>
                                {user?.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            
                            <div className="user-details">
                                <span style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>
                                    {user?.name || 'User'}
                                </span>
                                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                                    {user?.email || 'email@example.com'}
                                </span>
                            </div>
                        </div>

                        <span className="role-badge">{user?.role || 'user'}</span>

                        <button onClick={logout} className="logout-btn">
                            <LogOut size={16} />
                            <span>Logout</span>
                        </button>
                    </div>

                    {/* Mobile menu button */}
                    <button 
                        className="mobile-menu-btn"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    >
                        {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>

                {/* Mobile dropdown menu */}
                <div className={`mobile-dropdown ${mobileMenuOpen ? 'open' : ''}`}>
                    {/* Organization info & Role Badge Container */}
                    <div style={{ 
                        padding: '8px 0', 
                        borderBottom: '1px solid #f1f5f9',
                        marginBottom: '4px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            {/* Left Side: Organization Name */}
                            <div>
                                <span style={{ 
                                    fontSize: '11px', 
                                    color: '#94a3b8', 
                                    textTransform: 'uppercase', 
                                    fontWeight: 600, 
                                    letterSpacing: '0.05em'
                                }}>
                                    Organization
                                </span>
                                <h3 style={{ 
                                    margin: '4px 0 0 0', 
                                    fontSize: '17px', 
                                    fontWeight: 600, 
                                    color: '#1e293b' 
                                }}>
                                    {user?.organizationName || 'Organization'}
                                </h3>
                            </div>

                            {/* Right Side: Role Badge (Moved Here) */}
                            <span className="role-badge">
                                {user?.role || 'user'}
                            </span>
                        </div>
                    </div>

                    {/* User card */}
                    <div className="mobile-user-card">
                        <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%)',
                            border: '2px solid #ffffff',
                            boxShadow: '0 0 0 1px #e0e7ff',
                            color: '#667eea',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '18px',
                            flexShrink: 0
                        }}>
                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '15px', fontWeight: 600, color: '#334155' }}>
                                {user?.name || 'User'}
                            </div>
                            <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                                {user?.email || 'email@example.com'}
                            </div>
                        </div>
                        {/* Role Badge removed from here */}
                    </div>

                    {/* Settings Link */}
                    <Link
                        to="/settings"
                        onClick={() => setMobileMenuOpen(false)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '14px 16px',
                            fontSize: '15px',
                            fontWeight: 600,
                            color: '#334155',
                            textDecoration: 'none',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        <Settings size={18} />
                        <span>Settings</span>
                    </Link>

                    {/* Logout button */}
                    <button
                        onClick={() => {
                            setMobileMenuOpen(false);
                            logout();
                        }}
                        className="mobile-logout-btn"
                    >
                        <LogOut size={18} />
                        <span>Sign out</span>
                    </button>
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
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '12px 24px',
                        borderRadius: '10px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.35)',
                        transition: 'all 0.2s ease',
                        fontSize: '14px'
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.45)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.35)';
                    }}
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