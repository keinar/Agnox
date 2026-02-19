import { ExecutionRow } from '../ExecutionRow';

interface Execution {
  _id?: string;
  taskId: string;
  status: string;
  image: string;
  folder?: string;
  startTime: string;
  endTime?: string;
  config?: {
    environment?: string;
    baseUrl?: string;
  };
  [key: string]: any;
}

interface ExecutionListProps {
  executions: Execution[];
  loading: boolean;
  error: string | null;
  expandedRowId: string | null;
  onToggleRow: (id: string) => void;
  onDelete: (taskId: string) => Promise<void>;
}

export function ExecutionList({
  executions,
  loading,
  error,
  expandedRowId,
  onToggleRow,
  onDelete
}: ExecutionListProps) {
  if (error) {
    return (
      <div className="text-red-500 text-center p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Source</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Task ID</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Environment</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Start Time</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Duration</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading && executions.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center py-8 text-slate-400">
                Loading live data...
              </td>
            </tr>
          )}

          {executions.map((exec) => (
            <ExecutionRow
              key={exec._id || exec.taskId}
              execution={exec}
              isExpanded={expandedRowId === (exec._id || exec.taskId)}
              onToggle={() => onToggleRow(exec._id || exec.taskId)}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
