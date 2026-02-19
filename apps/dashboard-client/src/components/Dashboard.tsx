import { useState, useCallback } from 'react';
import { useExecutions } from '../hooks/useExecutions';
import { useDashboardData } from '../hooks/useDashboardData';
import { useAuth } from '../context/AuthContext';
import { StatsGrid } from './StatsGrid';
import { ExecutionModal } from './ExecutionModal';
import { DashboardHeader } from './dashboard/DashboardHeader';
import { ExecutionList } from './dashboard/ExecutionList';
import { Play } from 'lucide-react';


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
  // Real-time updates handled by useExecutions hook

  const toggleRow = useCallback((id: string) => {
    setExpandedRowId(prev => prev === id ? null : id);
  }, []);

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

      await response.json();
      setIsModalOpen(false);

    } catch (err: any) {
      console.error('Run test failed:', err);
      alert(`Error launching test: ${err.message}`);
    }
  };

  const handleDelete = useCallback(async (taskId: string) => {
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
  }, [token, setExecutions]);

  const isViewer = user?.role === 'viewer';

  return (
    <div className="max-w-7xl mx-auto px-5 py-6">
      {/* Header with Auth, Settings, Logout */}
      <DashboardHeader
        user={user}
        onLogout={logout}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      {/* Main Header with Title and Run Test Button */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="m-0 text-3xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            Automation Center
          </h1>
          <p className="text-slate-500 mt-1">
            Live monitoring of test infrastructure
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          disabled={isViewer}
          title={isViewer ? 'Viewers cannot run tests' : 'Run a new test'}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white border-none transition-all duration-200 ${
            isViewer
              ? 'bg-gradient-to-r from-gray-400 to-gray-500 opacity-60 cursor-not-allowed'
              : 'bg-gradient-to-r from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/35 cursor-pointer hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/45'
          }`}
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
