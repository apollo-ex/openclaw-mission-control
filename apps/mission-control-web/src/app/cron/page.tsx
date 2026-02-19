import { getCron } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function CronPage() {
  const payload = await getCron();

  return (
    <section>
      <h1>Cron</h1>
      <small>
        {payload.jobs.length} jobs · {payload.runs.length} runs
      </small>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Jobs</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Schedule</th>
                <th>Enabled</th>
                <th>Next Run</th>
              </tr>
            </thead>
            <tbody>
              {payload.jobs.map((job) => (
                <tr key={job.jobId}>
                  <td>{job.name}</td>
                  <td>{job.scheduleKind}</td>
                  <td>{job.enabled ? 'yes' : 'no'}</td>
                  <td>{job.nextRunAt ? new Date(job.nextRunAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Recent Runs</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Run</th>
                <th>Job</th>
                <th>Status</th>
                <th>Started</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {payload.runs.map((run) => (
                <tr key={run.runId}>
                  <td>{run.runId}</td>
                  <td>{run.jobId}</td>
                  <td>{run.status}</td>
                  <td>{run.startedAt ? new Date(run.startedAt).toLocaleString() : '—'}</td>
                  <td>{run.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
