import { useEffect, useState } from 'react';
import { api } from './api';
import {
  CategoryBadge, StatusPill, StatusSteps, STATUSES, STATUS_LABEL, CATEGORY_LABEL,
  CONFIRM_AT, affected, timeAgo,
} from './ui';

export default function ReportDetail({ id, me, onBack, onChanged }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [note, setNote] = useState('');

  const canModerate = !!me && (me.role === 'moderator' || me.role === 'admin');

  const load = () =>
    api(`/reports/${id}`).then(setReport).catch((e) => setError(e.message));

  useEffect(() => {
    setReport(null);
    setError('');
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const toggleConfirm = async () => {
    setBusy(true);
    setError('');
    try {
      await api(`/reports/${id}/confirm`, { method: report.confirmed_by_me ? 'DELETE' : 'POST' });
      await load();
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/reports/${id}/status`, { method: 'PATCH', body: { status: newStatus, note } });
      setNote('');
      setNewStatus('');
      await load();
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!report) {
    return (
      <div className="detail">
        <button className="back" onClick={onBack}>&larr; All reports</button>
        {error ? <p className="error" style={{ margin: 0 }}>{error}</p> : <p className="muted">Loading report...</p>}
      </div>
    );
  }

  const n = affected(report);
  const events = [
    { key: 'created', label: 'Reported', at: report.created_at, note: null },
    ...report.updates.map((u, i) => ({
      key: `u${i}`,
      label: STATUS_LABEL[u.new_status] || u.new_status,
      at: u.created_at,
      note: u.note,
    })),
  ];

  return (
    <div className="detail">
      <button className="back" onClick={onBack}>&larr; All reports</button>

      <div className="d-head">
        <CategoryBadge category={report.category} large />
        <div>
          <h2>{report.title}</h2>
          <div className="d-meta">
            <span>{CATEGORY_LABEL[report.category]}</span>
            <span>Reported {timeAgo(report.created_at)}</span>
            {report.mine && <span>Reported by you</span>}
          </div>
        </div>
      </div>

      {report.description && <p className="desc">{report.description}</p>}

      <StatusSteps status={report.status} />

      {error && <p className="error" style={{ margin: '8px 0' }}>{error}</p>}

      <div className="confirm">
        <div>
          <b>{n} {n === 1 ? 'person' : 'people'} affected</b>
          <span>
            {report.status === 'reported' && n < CONFIRM_AT
              ? `Counts as confirmed at ${CONFIRM_AT} people.`
              : report.status === 'resolved'
              ? 'This problem has been resolved.'
              : 'Enough residents have backed this report.'}
          </span>
        </div>
        {!report.mine && report.status !== 'resolved' && (
          <button
            className={`btn-confirm ${report.confirmed_by_me ? 'on' : ''}`}
            onClick={toggleConfirm}
            disabled={busy}
          >
            {report.confirmed_by_me ? 'You confirmed. Undo' : 'I have this too'}
          </button>
        )}
      </div>

      <h3 className="sec">History</h3>
      <ol>
        {events.map((ev) => (
          <li className="tl" key={ev.key}>
            <b>{ev.label}</b>
            <small>{timeAgo(ev.at)}</small>
            {ev.note && <p>{ev.note}</p>}
          </li>
        ))}
      </ol>

      {canModerate && (
        <form className="mod" onSubmit={updateStatus}>
          <h4>Update status</h4>
          <div className="field">
            <label htmlFor="ns">Move to</label>
            <select id="ns" value={newStatus} onChange={(e) => setNewStatus(e.target.value)} required>
              <option value="">Choose a status</option>
              {STATUSES.filter((s) => s !== report.status).map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="note">Note for residents (optional)</label>
            <textarea id="note" rows="2" maxLength={500} placeholder="e.g. Municipal team dispatched"
              value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy || !newStatus}>
            {busy ? 'Saving...' : 'Update status'}
          </button>
        </form>
      )}
    </div>
  );
}