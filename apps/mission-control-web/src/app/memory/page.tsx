import { getMemory } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function MemoryPage() {
  const payload = await getMemory();

  return (
    <section>
      <div className="page-head">
        <h1>Memory Deck</h1>
        <small>
          {payload.docs.length} docs · {payload.redactedDocs} redacted
        </small>
      </div>

      <div className="grid" style={{ marginBottom: 12 }}>
        <article className="kpi">
          <h3>Total Docs</h3>
          <div className="value">{payload.docs.length}</div>
        </article>
        <article className="kpi">
          <h3>Redacted</h3>
          <div className="value">{payload.redactedDocs}</div>
        </article>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Memory Registry</h2>
        <div className="memory-list">
          {payload.docs.map((doc) => (
            <article key={doc.path} className="memory-item">
              <div className="memory-item-head">
                <code>{doc.path}</code>
                <span className={doc.redacted ? 'pill warn' : 'pill ok'}>{doc.redacted ? 'redacted' : 'clean'}</span>
              </div>
              <div className="memory-meta">
                <span>Kind: {doc.kind}</span>
                <span>Updated: {new Date(doc.updatedAt).toLocaleString()}</span>
              </div>
              <p>{doc.summary}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
