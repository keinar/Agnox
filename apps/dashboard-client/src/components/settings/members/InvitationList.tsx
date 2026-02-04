import { Mail } from 'lucide-react';

interface Invitation {
  id: string;
  email: string;
  role: string;
  invitedByName: string;
  expiresAt: string;
  status: string;
  createdAt: string;
}

interface InvitationListProps {
  invitations: Invitation[];
  isMobile: boolean;
  onRevoke: (invitationId: string) => Promise<void>;
  formatDate: (dateString: string) => string;
  getRoleBadgeStyle: (role: string) => React.CSSProperties;
}

const styles = {
  container: {
    marginTop: '48px',
  } as React.CSSProperties,
  title: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1e293b',
    margin: 0,
    marginBottom: '16px',
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

export function InvitationList({
  invitations,
  isMobile,
  onRevoke,
  formatDate,
  getRoleBadgeStyle
}: InvitationListProps) {
  if (invitations.length === 0) return null;

  const renderMobileView = () => (
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
          <button onClick={() => onRevoke(inv.id)} style={styles.deleteButton}>
            Revoke Invitation
          </button>
        </div>
      ))}
    </div>
  );

  const renderDesktopView = () => (
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
              <td style={styles.td}>
                <span style={getRoleBadgeStyle(inv.role)}>{inv.role}</span>
              </td>
              <td style={styles.td}>{inv.invitedByName}</td>
              <td style={styles.td}>{formatDate(inv.expiresAt)}</td>
              <td style={styles.td}>
                <button onClick={() => onRevoke(inv.id)} style={styles.revokeButton}>
                  Revoke
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Pending Invitations ({invitations.length})</h2>
      {isMobile ? renderMobileView() : renderDesktopView()}
    </div>
  );
}
