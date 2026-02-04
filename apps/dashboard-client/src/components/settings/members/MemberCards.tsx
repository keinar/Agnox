import { Trash2, Clock } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  lastLoginAt?: string;
}

interface MemberCardsProps {
  users: User[];
  currentUserId: string | undefined;
  isAdmin: boolean;
  onRoleChange: (userId: string, newRole: string) => Promise<void>;
  onRemove: (userId: string, userName: string) => Promise<void>;
  formatDate: (dateString: string) => string;
  getRoleBadgeStyle: (role: string) => React.CSSProperties;
}

const styles = {
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
};

export function MemberCards({
  users,
  currentUserId,
  isAdmin,
  onRoleChange,
  onRemove,
  formatDate,
  getRoleBadgeStyle
}: MemberCardsProps) {
  return (
    <div style={styles.cardsContainer}>
      {users.map((u) => (
        <div key={u.id} style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={{ fontWeight: 600, color: '#1e293b' }}>
                {u.name} {u.id === currentUserId && '(You)'}
              </div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                {u.email}
              </div>
            </div>
            {/* Role Badge (Non-Admin View) */}
            {(!isAdmin || u.id === currentUserId) && (
              <span style={getRoleBadgeStyle(u.role)}>{u.role}</span>
            )}
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
            <div style={styles.cardRow}>
              <Clock size={14} /> Joined {formatDate(u.createdAt)}
            </div>
          </div>

          {/* Admin Actions */}
          {isAdmin && u.id !== currentUserId && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <div style={{ flex: 1 }}>
                <select
                  value={u.role}
                  onChange={(e) => onRoleChange(u.id, e.target.value)}
                  style={styles.select}
                >
                  <option value="admin">Admin</option>
                  <option value="developer">Developer</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <button
                  onClick={() => onRemove(u.id, u.name)}
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
