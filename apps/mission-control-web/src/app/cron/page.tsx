import { getCron } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const dynamic = 'force-dynamic';

const statusClass = (status: string): string => {
  const value = status.toLowerCase();
  if (value.includes('ok') || value.includes('success')) return 'pill success';
  if (value.includes('fail') || value.includes('error')) return 'pill danger';
  return 'pill';
};

export default async function CronPage() {
  const payload = await getCron();

  return (
    <section>
      <div className="page-head">
        <h1>Cron Control Center</h1>
        <small>
          {payload.jobs.length} jobs · {payload.runs.length} runs
        </small>
      </div>

      <div className="grid" style={{ marginBottom: 16 }}>
        <article className="kpi">
          <h3>Enabled Jobs</h3>
          <div className="value">{payload.jobs.filter((j) => j.enabled).length}</div>
        </article>
        <article className="kpi">
          <h3>Disabled Jobs</h3>
          <div className="value">{payload.jobs.filter((j) => !j.enabled).length}</div>
        </article>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Jobs + Script Setup</h2>
        <div className="accordion-list">
          {payload.jobs.map((job) => (
            <details key={job.jobId} className="job-panel">
              <summary>
                <span>
                  <strong>{job.name}</strong>
                  <small>{job.jobId}</small>
                </span>
                <span className={job.enabled ? 'pill success' : 'pill danger'}>{job.enabled ? 'enabled' : 'disabled'}</span>
              </summary>

              <div className="job-meta">
                <div>
                  <label>Schedule</label>
                  <div>{job.scheduleKind}</div>
                </div>
                <div>
                  <label>Next run</label>
                  <div>{job.nextRunAt ? new Date(job.nextRunAt).toLocaleString() : '—'}</div>
                </div>
                <div>
                  <label>Updated</label>
                  <div>{new Date(job.updatedAt).toLocaleString()}</div>
                </div>
              </div>

              <div className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{job.detailsMarkdown}</ReactMarkdown>
              </div>
            </details>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Recent Runs</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Job</th>
                <th>Started</th>
                <th>Ended</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {payload.runs.map((run) => (
                <tr key={run.runId}>
                  <td>
                    <span className={statusClass(run.status)}>{run.status}</span>
                  </td>
                  <td>{run.jobId}</td>
                  <td>{run.startedAt ? new Date(run.startedAt).toLocaleString() : '—'}</td>
                  <td>{run.endedAt ? new Date(run.endedAt).toLocaleString() : '—'}</td>
                  <td>{run.summary || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
