import { useEffect, useState } from 'react';
import { useExecutions } from '../hooks/useExecutions';
import { useDashboardData } from '../hooks/useDashboardData';
import { useAuth } from '../context/AuthContext';
import { StatsGrid } from './StatsGrid';
import { ExecutionModal } from './ExecutionModal';
import { DashboardHeader } from './dashboard/DashboardHeader';
import { ExecutionList } from './dashboard/ExecutionList';
import { Play } from 'lucide-react';
import io from 'socket.io-client';

const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_URL = isProduction
  ? import.meta.env.VITE_API_URL || ''
  : 'http://localhost:3000';

export const Dashboard = () => {
  const { user, token, logout } = useAuth();
  const { executions, loading, error, setExecutions } = useExecutions();
  const { availableFolders, defaults } = useDashboardData(token);

  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Socket.io connection for real-time updates
  useEffect(() => {
    if (!token) return;

    const socket = io(API_URL, {
      auth: {
        token
      }
    });

    socket.on('connect', () => {
      console.log('Socket.io connected');
    });

    socket.on('auth-success', (data) => {
      console.log('Socket.io authenticated:', data);
    });

    socket.on('auth-error', (error) => {
      console.error('Socket.io auth error:', error);
    });

    socket.on('execution-updated', (updatedExecution: any) => {
      console.log('Execution updated:', updatedExecution);
      setExecutions((prev) => {
        const index = prev.findIndex((exec) => exec.taskId === updatedExecution.taskId);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = { ...updated[index], ...updatedExecution };
          return updated;
        } else {
          return [updatedExecution, ...prev];
        }
      });
    });

    socket.on('execution-log', (data: { taskId: string; log: string }) => {
      console.log(`Log from ${data.taskId}:`, data.log);
    });

    return () => {
      socket.disconnect();
    };
  }, [token, setExecutions]);

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

  return (
    <div className="container">
      {/* Header with Auth, Settings, Logout */}
      <DashboardHeader
        user={user}
        onLogout={logout}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      {/* Main Header with Title and Run Test Button */}
      <div className="header">
        <div className="title">
          <h1>Automation Center</h1>
          <p style={{ color: '#94a3b8', marginTop: '4px' }}>
            Live monitoring of test infrastructure
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          disabled={user?.role === 'viewer'}
          title={user?.role === 'viewer' ? 'Viewers cannot run tests' : 'Run a new test'}
          style={{
            background: user?.role === 'viewer'
              ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '10px',
            fontWeight: 600,
            cursor: user?.role === 'viewer' ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: user?.role === 'viewer'
              ? 'none'
              : '0 4px 12px rgba(102, 126, 234, 0.35)',
            transition: 'all 0.2s ease',
            fontSize: '14px',
            opacity: user?.role === 'viewer' ? 0.6 : 1
          }}
          onMouseOver={(e) => {
            if (user?.role !== 'viewer') {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.45)';
            }
          }}
          onMouseOut={(e) => {
            if (user?.role !== 'viewer') {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.35)';
            }
          }}
        >
          <Play size={18} /> Run New Test
        </button>
      </div>

      {/* Stats Grid */}
      <StatsGrid executions={executions} />

      {/* Execution Modal */}
      <ExecutionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleRunTest}
        availableFolders={availableFolders}
        defaults={defaults}
      />

      {/* Execution List Table */}
      <ExecutionList
        executions={executions}
        loading={loading}
        error={error}
        expandedRowId={expandedRowId}
        onToggleRow={toggleRow}
        onDelete={handleDelete}
      />
    </div>
  );
};
