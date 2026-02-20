import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { InviteModal } from './InviteModal';
import { MemberTable } from './members/MemberTable';
import { MemberCards } from './members/MemberCards';
import { InvitationList } from './members/InvitationList';
import axios from 'axios';
import { UserPlus } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  lastLoginAt?: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  invitedByName: string;
  expiresAt: string;
  status: string;
  createdAt: string;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return isMobile;
}

function getRoleBadgeClass(role: string): string {
  switch (role) {
    case 'admin':
      return 'inline-block px-2.5 py-1 rounded-md text-xs font-semibold uppercase bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
    case 'developer':
      return 'inline-block px-2.5 py-1 rounded-md text-xs font-semibold uppercase bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/60 dark:text-green-400 dark:border-green-800';
    case 'viewer':
      return 'inline-block px-2.5 py-1 rounded-md text-xs font-semibold uppercase bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    default:
      return 'inline-block px-2.5 py-1 rounded-md text-xs font-semibold uppercase bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
  }
}

export function MembersTab() {
  const { user, token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchUsers();
    if (isAdmin) fetchInvitations();
  }, []);

  async function fetchUsers() {
    try {
      const response = await axios.get(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) setUsers(response.data.users);
    } catch (err: any) {
      setError('Failed to load team members');
    } finally {
      setLoading(false);
    }
  }

  async function fetchInvitations() {
    try {
      const response = await axios.get(`${API_URL}/api/invitations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) setInvitations(response.data.invitations);
    } catch {
      // Silently ignore invitation fetch failures
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    if (userId === user?.id) {
      alert('You cannot change your own role');
      return;
    }
    try {
      const response = await axios.patch(
        `${API_URL}/api/users/${userId}/role`,
        { role: newRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to change user role');
    }
  }

  async function handleRemoveUser(userId: string, userName: string) {
    if (userId === user?.id) return;
    if (!window.confirm(`Remove ${userName} from the organization?`)) return;
    try {
      const response = await axios.delete(`${API_URL}/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to remove user');
    }
  }

  async function handleRevokeInvitation(invitationId: string) {
    if (!window.confirm('Revoke this invitation?')) return;
    try {
      const response = await axios.delete(`${API_URL}/api/invitations/${invitationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to revoke invitation');
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="text-sm text-slate-500 dark:text-slate-400">
        Loading team members...
      </div>
    );
  }

  return (
    <div className="max-w-full overflow-x-hidden">
      {error && (
        <div className="mb-4 px-4 py-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-gh-text-dark">
          Current Members ({users.length})
        </h2>
        {isAdmin && (
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors cursor-pointer"
          >
            <UserPlus size={16} /> Invite Member
          </button>
        )}
      </div>

      {users.length === 0 ? (
        <div className="text-center py-8 text-slate-400 dark:text-slate-500">
          No team members found
        </div>
      ) : (
        <>
          {isMobile ? (
            <MemberCards
              users={users}
              currentUserId={user?.id}
              isAdmin={isAdmin}
              onRoleChange={handleRoleChange}
              onRemove={handleRemoveUser}
              formatDate={formatDate}
              getRoleBadgeClass={getRoleBadgeClass}
            />
          ) : (
            <MemberTable
              users={users}
              currentUserId={user?.id}
              isAdmin={isAdmin}
              onRoleChange={handleRoleChange}
              onRemove={handleRemoveUser}
              formatDate={formatDate}
              getRoleBadgeClass={getRoleBadgeClass}
            />
          )}
        </>
      )}

      {isAdmin && (
        <InvitationList
          invitations={invitations}
          isMobile={isMobile}
          onRevoke={handleRevokeInvitation}
          formatDate={formatDate}
          getRoleBadgeClass={getRoleBadgeClass}
        />
      )}

      {isInviteModalOpen && (
        <InviteModal
          onClose={() => setIsInviteModalOpen(false)}
          onSuccess={() => {
            setIsInviteModalOpen(false);
            fetchInvitations();
          }}
        />
      )}
    </div>
  );
}
