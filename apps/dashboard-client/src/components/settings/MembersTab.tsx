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

const styles = {
  container: {
    maxWidth: '100%',
    overflowX: 'hidden' as const,
  } as React.CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap' as const,
    gap: '16px',
  } as React.CSSProperties,
  title: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1e293b',
    margin: 0,
  } as React.CSSProperties,
  inviteButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#ffffff',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  } as React.CSSProperties,
  errorMessage: {
    padding: '12px 16px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '14px',
    marginBottom: '16px',
  } as React.CSSProperties,
  badge: {
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    display: 'inline-block',
  } as React.CSSProperties,
  adminBadge: { background: '#f0f4ff', color: '#667eea', border: '1px solid #c7d2fe' },
  developerBadge: { background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac' },
  viewerBadge: { background: '#f3f4f6', color: '#6b7280', border: '1px solid #d1d5db' },
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return isMobile;
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
    } catch (error: any) {
      console.error('Failed to fetch users:', error);
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
    } catch (error: any) {
      console.error('Failed to fetch invitations:', error);
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
    } catch (error: any) {
      console.error('Failed to change role:', error);
      alert(error.response?.data?.message || 'Failed to change user role');
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
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to remove user');
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
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to revoke invitation');
    }
  }

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'admin':
        return { ...styles.badge, ...styles.adminBadge };
      case 'developer':
        return { ...styles.badge, ...styles.developerBadge };
      case 'viewer':
        return { ...styles.badge, ...styles.viewerBadge };
      default:
        return styles.badge;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div style={{ color: '#6b7280', fontSize: '14px' }}>
        Loading team members...
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {error && <div style={styles.errorMessage}>{error}</div>}

      <div style={styles.header}>
        <h2 style={styles.title}>Current Members ({users.length})</h2>
        {isAdmin && (
          <button onClick={() => setIsInviteModalOpen(true)} style={styles.inviteButton}>
            <UserPlus size={18} /> Invite Member
          </button>
        )}
      </div>

      {users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#9ca3af' }}>
          No team members found
        </div>
      ) : (
        <>
          {/* Desktop: Table, Mobile: Cards */}
          {isMobile ? (
            <MemberCards
              users={users}
              currentUserId={user?.id}
              isAdmin={isAdmin}
              onRoleChange={handleRoleChange}
              onRemove={handleRemoveUser}
              formatDate={formatDate}
              getRoleBadgeStyle={getRoleBadgeStyle}
            />
          ) : (
            <MemberTable
              users={users}
              currentUserId={user?.id}
              isAdmin={isAdmin}
              onRoleChange={handleRoleChange}
              onRemove={handleRemoveUser}
              formatDate={formatDate}
              getRoleBadgeStyle={getRoleBadgeStyle}
            />
          )}
        </>
      )}

      {/* Pending Invitations */}
      {isAdmin && (
        <InvitationList
          invitations={invitations}
          isMobile={isMobile}
          onRevoke={handleRevokeInvitation}
          formatDate={formatDate}
          getRoleBadgeStyle={getRoleBadgeStyle}
        />
      )}

      {/* Invite Modal */}
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
