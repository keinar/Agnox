import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { InviteModal } from './InviteModal';
import axios from 'axios';
import { UserPlus, Trash2, Mail, Clock, Shield, User as UserIcon } from 'lucide-react';

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

  tableContainer: {
    overflowX: 'auto',
    borderRadius: '8px',
    border: '1px solid #f1f5f9',
  } as React.CSSProperties,
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    minWidth: '600px',
  } as React.CSSProperties,
  th: {
    textAlign: 'left' as const,
    padding: '12px 16px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    borderBottom: '2px solid #f3f4f6',
    background: '#f8fafc',
  } as React.CSSProperties,
  td: {
    padding: '16px',
    fontSize: '14px',
    color: '#374151',
    borderBottom: '1px solid #f3f4f6',
    verticalAlign: 'middle',
  } as React.CSSProperties,

  cardsContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  } as React.CSSProperties,
  card: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  } as React.CSSProperties,
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  } as React.CSSProperties,
  cardRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#4b5563',
  } as React.CSSProperties,
  
  select: {
    padding: '6px 12px',
    fontSize: '14px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    outline: 'none',
    cursor: 'pointer',
    background: '#ffffff',
    width: '100%',
  } as React.CSSProperties,
  deleteButton: {
    padding: '8px 12px',
    fontSize: '13px',
    color: '#dc2626',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    width: '100%',
  } as React.CSSProperties,
  revokeButton: {
    padding: '6px 12px',
    fontSize: '13px',
    color: '#dc2626',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
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
  errorMessage: {
    padding: '12px 16px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '14px',
    marginBottom: '16px',
  } as React.CSSProperties,
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
      case 'admin': return { ...styles.badge, ...styles.adminBadge };
      case 'developer': return { ...styles.badge, ...styles.developerBadge };
      case 'viewer': return { ...styles.badge, ...styles.viewerBadge };
      default: return styles.badge;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  if (loading) return <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading team members...</div>;

  const renderUsersList = () => {
    if (isMobile) {
      // --- Mobile View (Cards) ---
      return (
        <div style={styles.cardsContainer}>
          {users.map((u) => (
            <div key={u.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>{u.name} {u.id === user?.id && '(You)'}</div>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>{u.email}</div>
                </div>
                {/* Role Badge (Non-Admin View) */}
                {(!isAdmin || u.id === user?.id) && (
                  <span style={getRoleBadgeStyle(u.role)}>{u.role}</span>
                )}
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                <div style={styles.cardRow}>
                  <Clock size={14} /> Joined {formatDate(u.createdAt)}
                </div>
              </div>

              {/* Admin Actions */}
              {isAdmin && u.id !== user?.id && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      style={styles.select}
                    >
                      <option value="admin">Admin</option>
                      <option value="developer">Developer</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <button
                      onClick={() => handleRemoveUser(u.id, u.name)}
                      style={styles.deleteButton}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    // --- Desktop View (Table) ---
    return (
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Role</th>
              <th style={styles.th}>Joined</th>
              {isAdmin && <th style={styles.th}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={styles.td}>
                  <strong>{u.name}</strong>
                  {u.id === user?.id && <span style={{ marginLeft: '8px', color: '#6b7280', fontSize: '12px' }}>(You)</span>}
                </td>
                <td style={styles.td}>{u.email}</td>
                <td style={styles.td}>
                  {isAdmin && u.id !== user?.id ? (
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      style={{ ...styles.select, width: 'auto' }}
                    >
                      <option value="admin">Admin</option>
                      <option value="developer">Developer</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <span style={getRoleBadgeStyle(u.role)}>{u.role}</span>
                  )}
                </td>
                <td style={styles.td}>{formatDate(u.createdAt)}</td>
                {isAdmin && (
                  <td style={styles.td}>
                    <button
                      onClick={() => handleRemoveUser(u.id, u.name)}
                      disabled={u.id === user?.id}
                      style={{ ...styles.deleteButton, width: 'auto', opacity: u.id === user?.id ? 0.5 : 1 }}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderInvitationsList = () => {
    if (invitations.length === 0) return null;

    if (isMobile) {
        // Mobile Invitations
        return (
            <div style={styles.cardsContainer}>
                {invitations.map((inv) => (
                    <div key={inv.id} style={styles.card}>
                        <div style={styles.cardHeader}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
                                <Mail size={16} color="#6b7280" />
                                {inv.email}
                             </div>
                             <span style={getRoleBadgeStyle(inv.role)}>{inv.role}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b' }}>
                            Invited by {inv.invitedByName} • Expires {formatDate(inv.expiresAt)}
                        </div>
                        <button onClick={() => handleRevokeInvitation(inv.id)} style={styles.deleteButton}>
                            Revoke Invitation
                        </button>
                    </div>
                ))}
            </div>
        )
    }

    // Desktop Invitations
    return (
        <div style={styles.tableContainer}>
        <table style={styles.table}>
            <thead>
            <tr>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Role</th>
                <th style={styles.th}>Invited By</th>
                <th style={styles.th}>Expires</th>
                <th style={styles.th}>Actions</th>
            </tr>
            </thead>
            <tbody>
            {invitations.map((inv) => (
                <tr key={inv.id}>
                <td style={styles.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Mail size={16} color="#6b7280" />
                    {inv.email}
                    </div>
                </td>
                <td style={styles.td}><span style={getRoleBadgeStyle(inv.role)}>{inv.role}</span></td>
                <td style={styles.td}>{inv.invitedByName}</td>
                <td style={styles.td}>{formatDate(inv.expiresAt)}</td>
                <td style={styles.td}>
                    <button onClick={() => handleRevokeInvitation(inv.id)} style={styles.revokeButton}>
                    Revoke
                    </button>
                </td>
                </tr>
            ))}
            </tbody>
        </table>
        </div>
    );
  };

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
          <div style={{ textAlign: 'center', padding: '32px', color: '#9ca3af' }}>No team members found</div>
      ) : (
          renderUsersList()
      )}

      {isAdmin && invitations.length > 0 && (
        <div style={{ marginTop: '48px' }}>
          <h2 style={{ ...styles.title, marginBottom: '16px' }}>Pending Invitations ({invitations.length})</h2>
          {renderInvitationsList()}
        </div>
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