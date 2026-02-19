import { getMemory } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function MemoryPage() {
  const payload = await getMemory();

  return (
    <section>
      <h1>Memory</h1>
      <small>
        {payload.docs.length} docs · {payload.redactedDocs} redacted
      </small>

      <div className="card" style={{ marginTop: 16 }}>
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
                  <td>{doc.redacted ? 'yes' : 'no'}</td>
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
