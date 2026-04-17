interface ResearchQueueItem {
  id: string;
  topic: string;
  status: string;
  priority: string;
}

interface ResearchQueueProps {
  items: ResearchQueueItem[];
}

export function ResearchQueue({ items }: ResearchQueueProps) {
  return (
    <section className="panel research-panel">
      <h2>RESEARCH QUEUE</h2>
      <div className="research-list">
        {(!items || items.length === 0) && (
          <div className="empty-state">Queue empty</div>
        )}
        {(items || []).map(item => (
          <div key={item.id} className="research-row">
            <span className={`status-badge ${item.status}`}>{item.status}</span>
            <span className="research-topic">{item.topic}</span>
            <span className="research-priority text-muted">P{item.priority}</span>
          </div>
        ))}
      </div>
    </section>
  );
}