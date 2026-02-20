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
  getRoleBadgeClass: (role: string) => string;
}

export function MemberTable({
  users,
  currentUserId,
  isAdmin,
  onRoleChange,
  onRemove,
  formatDate,
  getRoleBadgeClass,
}: MemberTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-gh-border-dark">
      <table className="w-full border-collapse" style={{ minWidth: '600px' }}>
        <thead>
          <tr className="bg-slate-50 dark:bg-gh-bg-subtle-dark border-b-2 border-slate-200 dark:border-gh-border-dark">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Name</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Email</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Role</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Joined</th>
            {isAdmin && <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr
              key={u.id}
              className="border-b border-slate-100 dark:border-gh-border-dark hover:bg-slate-50 dark:hover:bg-gh-bg-subtle-dark transition-colors"
            >
              <td className="px-4 py-4 text-sm text-slate-700 dark:text-gh-text-dark align-middle">
                <span className="font-semibold">{u.name}</span>
                {u.id === currentUserId && (
                  <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">(You)</span>
                )}
              </td>
              <td className="px-4 py-4 text-sm text-slate-700 dark:text-gh-text-dark align-middle">{u.email}</td>
              <td className="px-4 py-4 text-sm align-middle">
                {isAdmin && u.id !== currentUserId ? (
                  <select
                    value={u.role}
                    onChange={(e) => onRoleChange(u.id, e.target.value)}
                    className="px-3 py-1.5 text-sm border border-slate-200 dark:border-gh-border-dark rounded-md outline-none cursor-pointer bg-white dark:bg-gh-bg-dark text-slate-700 dark:text-gh-text-dark transition-colors"
                  >
                    <option value="admin">Admin</option>
                    <option value="developer">Developer</option>
                    <option value="viewer">Viewer</option>
                  </select>
                ) : (
                  <span className={getRoleBadgeClass(u.role)}>{u.role}</span>
                )}
              </td>
              <td className="px-4 py-4 text-sm text-slate-700 dark:text-gh-text-dark align-middle">{formatDate(u.createdAt)}</td>
              {isAdmin && (
                <td className="px-4 py-4 text-sm align-middle">
                  <button
                    onClick={() => onRemove(u.id, u.name)}
                    disabled={u.id === currentUserId}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-md hover:bg-rose-100 dark:hover:bg-rose-950/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Trash2 size={13} /> Remove
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
