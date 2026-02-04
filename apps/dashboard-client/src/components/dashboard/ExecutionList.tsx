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
      <div style={{ color: '#ef4444', padding: '20px', textAlign: 'center' }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Source</th>
            <th>Task ID</th>
            <th>Environment</th>
            <th>Start Time</th>
            <th>Duration</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading && executions.length === 0 && (
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
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
