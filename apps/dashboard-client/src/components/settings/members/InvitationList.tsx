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
  getRoleBadgeClass: (role: string) => string;
}

export function InvitationList({
  invitations,
  isMobile,
  onRevoke,
  formatDate,
  getRoleBadgeClass,
}: InvitationListProps) {
  if (invitations.length === 0) return null;

  const renderMobileView = () => (
    <div className="flex flex-col gap-4">
      {invitations.map((inv) => (
        <div
          key={inv.id}
          className="bg-white dark:bg-gh-bg-dark border border-slate-200 dark:border-gh-border-dark rounded-xl p-4 flex flex-col gap-3"
        >
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-gh-text-dark">
              <Mail size={14} className="text-slate-400 dark:text-slate-500" />
              {inv.email}
            </div>
            <span className={getRoleBadgeClass(inv.role)}>{inv.role}</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Invited by {inv.invitedByName} · Expires {formatDate(inv.expiresAt)}
          </div>
          <button
            onClick={() => onRevoke(inv.id)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-md hover:bg-rose-100 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
          >
            Revoke Invitation
          </button>
        </div>
      ))}
    </div>
  );

  const renderDesktopView = () => (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-gh-border-dark">
      <table className="w-full border-collapse" style={{ minWidth: '600px' }}>
        <thead>
          <tr className="bg-slate-50 dark:bg-gh-bg-subtle-dark border-b-2 border-slate-200 dark:border-gh-border-dark">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Email</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Role</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Invited By</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Expires</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Actions</th>
          </tr>
        </thead>
        <tbody>
          {invitations.map((inv) => (
            <tr
              key={inv.id}
              className="border-b border-slate-100 dark:border-gh-border-dark hover:bg-slate-50 dark:hover:bg-gh-bg-subtle-dark transition-colors"
            >
              <td className="px-4 py-4 text-sm text-slate-700 dark:text-gh-text-dark align-middle">
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-slate-400 dark:text-slate-500" />
                  {inv.email}
                </div>
              </td>
              <td className="px-4 py-4 text-sm align-middle">
                <span className={getRoleBadgeClass(inv.role)}>{inv.role}</span>
              </td>
              <td className="px-4 py-4 text-sm text-slate-700 dark:text-gh-text-dark align-middle">{inv.invitedByName}</td>
              <td className="px-4 py-4 text-sm text-slate-700 dark:text-gh-text-dark align-middle">{formatDate(inv.expiresAt)}</td>
              <td className="px-4 py-4 text-sm align-middle">
                <button
                  onClick={() => onRevoke(inv.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-md hover:bg-rose-100 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
                >
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
    <div className="mt-12">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-gh-text-dark mb-4">
        Pending Invitations ({invitations.length})
      </h2>
      {isMobile ? renderMobileView() : renderDesktopView()}
    </div>
  );
}
