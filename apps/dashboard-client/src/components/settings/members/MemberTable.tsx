import { Trash2 } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  lastLoginAt?: string;
}

interface MemberTableProps {
  users: User[];
  currentUserId: string | undefined;
  isAdmin: boolean;
  onRoleChange: (userId: string, newRole: string) => Promise<void>;
  onRemove: (userId: string, userName: string) => Promise<void>;
  formatDate: (dateString: string) => string;
  getRoleBadgeStyle: (role: string) => React.CSSProperties;
}

const styles = {
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
  select: {
    padding: '6px 12px',
    fontSize: '14px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    outline: 'none',
    cursor: 'pointer',
    background: '#ffffff',
    width: 'auto',
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
    width: 'auto',
  } as React.CSSProperties,
};

export function MemberTable({
  users,
  currentUserId,
  isAdmin,
  onRoleChange,
  onRemove,
  formatDate,
  getRoleBadgeStyle
}: MemberTableProps) {
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
                {u.id === currentUserId && (
                  <span style={{ marginLeft: '8px', color: '#6b7280', fontSize: '12px' }}>
                    (You)
                  </span>
                )}
              </td>
              <td style={styles.td}>{u.email}</td>
              <td style={styles.td}>
                {isAdmin && u.id !== currentUserId ? (
                  <select
                    value={u.role}
                    onChange={(e) => onRoleChange(u.id, e.target.value)}
                    style={styles.select}
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
                    onClick={() => onRemove(u.id, u.name)}
                    disabled={u.id === currentUserId}
                    style={{
                      ...styles.deleteButton,
                      opacity: u.id === currentUserId ? 0.5 : 1,
                      cursor: u.id === currentUserId ? 'not-allowed' : 'pointer'
                    }}
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
}
