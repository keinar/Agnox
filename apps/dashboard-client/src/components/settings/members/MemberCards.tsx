import { Clock, Trash2 } from 'lucide-react';

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
  getRoleBadgeClass: (role: string) => string;
}

export function MemberCards({
  users,
  currentUserId,
  isAdmin,
  onRoleChange,
  onRemove,
  formatDate,
  getRoleBadgeClass,
}: MemberCardsProps) {
  return (
    <div className="flex flex-col gap-4">
      {users.map((u) => (
        <div
          key={u.id}
          className="bg-white dark:bg-gh-bg-dark border border-slate-200 dark:border-gh-border-dark rounded-xl p-4 flex flex-col gap-3"
        >
          <div className="flex justify-between items-start">
            <div>
              <div className="font-semibold text-slate-900 dark:text-gh-text-dark">
                {u.name}{' '}
                {u.id === currentUserId && (
                  <span className="text-xs font-normal text-slate-400 dark:text-slate-500">(You)</span>
                )}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{u.email}</div>
            </div>
            {(!isAdmin || u.id === currentUserId) && (
              <span className={getRoleBadgeClass(u.role)}>{u.role}</span>
            )}
          </div>

          <div className="border-t border-slate-100 dark:border-gh-border-dark pt-3">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Clock size={12} /> Joined {formatDate(u.createdAt)}
            </div>
          </div>

          {isAdmin && u.id !== currentUserId && (
            <div className="flex gap-2 mt-1">
              <select
                value={u.role}
                onChange={(e) => onRoleChange(u.id, e.target.value)}
                className="flex-1 px-3 py-1.5 text-sm border border-slate-200 dark:border-gh-border-dark rounded-md outline-none cursor-pointer bg-white dark:bg-gh-bg-dark text-slate-700 dark:text-gh-text-dark transition-colors"
              >
                <option value="admin">Admin</option>
                <option value="developer">Developer</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                onClick={() => onRemove(u.id, u.name)}
                className="flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-md hover:bg-rose-100 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
              >
                <Trash2 size={13} /> Remove
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
