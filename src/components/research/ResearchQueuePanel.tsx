interface QueueItem {
  strategyId: string;
  strategyName?: string;
  startedAt?: string;
  priority?: number;
  status?: string;
  completedAt?: string;
}

interface ResearchQueuePanelProps {
  queue: {
    pending: QueueItem[];
    inProgress: QueueItem[];
    completed: QueueItem[];
  };
}

function fmt(ts?: string): string {
  if (!ts) return '\u2014';
  try { return new Date(ts).toLocaleTimeString(); } catch { return ts; }
}

export function ResearchQueuePanel({ queue }: ResearchQueuePanelProps) {
  const pending = queue?.pending || [];
  const inProgress = queue?.inProgress || [];
  const completed = queue?.completed || [];

  return (
    <section className="panel research-queue-panel">
      <h2>RESEARCH PIPELINE</h2>

      <div className="rq-section">
        <h3 className="rq-heading">
          In Progress
          {inProgress.length > 0 && (
            <span className="rq-badge rq-badge-progress">{inProgress.length}</span>
          )}
        </h3>
        {inProgress.length === 0
          ? <div className="empty-state">None running</div>
          : (
            <table className="rq-table">
              <thead>
                <tr><th>Strategy</th><th>Started</th></tr>
              </thead>
              <tbody>
                {inProgress.map((item, i) => (
                  <tr key={item.strategyId || i}>
                    <td>{item.strategyName || item.strategyId}</td>
                    <td className="mono text-muted">{fmt(item.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>

      <div className="rq-section">
        <h3 className="rq-heading">
          Pending
          {pending.length > 0 && (
            <span className="rq-badge rq-badge-pending">{pending.length}</span>
          )}
        </h3>
        {pending.length === 0
          ? <div className="empty-state">Queue empty</div>
          : (
            <table className="rq-table">
              <thead>
                <tr><th>Strategy</th><th>Priority</th></tr>
              </thead>
              <tbody>
                {pending.map((item, i) => (
                  <tr key={item.strategyId || i}>
                    <td>{item.strategyName || item.strategyId}</td>
                    <td className="mono text-muted">{item.priority != null ? `P${item.priority}` : '\u2014'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>

      <div className="rq-section">
        <h3 className="rq-heading">Recently Completed</h3>
        {completed.length === 0
          ? <div className="empty-state">No completed runs</div>
          : (
            <table className="rq-table">
              <thead>
                <tr><th>Strategy</th><th>Result</th><th>Completed</th></tr>
              </thead>
              <tbody>
                {completed.slice(0, 10).map((item, i) => (
                  <tr key={`${item.strategyId}-${i}`}>
                    <td>{item.strategyName || item.strategyId}</td>
                    <td>
                      <span className={`status-badge ${item.status === 'pass' ? 'pass' : 'fail'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="mono text-muted">{fmt(item.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>
    </section>
  );
}