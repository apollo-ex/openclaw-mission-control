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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Path</th>
                <th>Kind</th>
                <th>Updated</th>
                <th>Redacted</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {payload.docs.map((doc) => (
                <tr key={doc.path}>
                  <td>{doc.path}</td>
                  <td>{doc.kind}</td>
                  <td>{new Date(doc.updatedAt).toLocaleString()}</td>
                  <td>
                    <span className={doc.redacted ? 'pill warn' : 'pill ok'}>{doc.redacted ? 'yes' : 'no'}</span>
                  </td>
                  <td>{doc.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
