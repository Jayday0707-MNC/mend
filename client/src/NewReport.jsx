import { useEffect, useState } from 'react';
import { api } from './api';
import { CATEGORIES, CATEGORY_LABEL, CategoryIcon, StatusPill, affected } from './ui';

export default function NewReport({ picked, locating, onUseLocation, onCancel, onCreated, onConfirmed }) {
  const [category, setCategory] = useState('water');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [nearby, setNearby] = useState([]);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Duplicate check: look for open reports of this type close to the pin
  useEffect(() => {
    setDismissed(false);
    if (!picked) {
      setNearby([]);
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({ category, lat: picked.lat, lng: picked.lng });
    api(`/reports/nearby?${params}`)
      .then((list) => !cancelled && setNearby(list))
      .catch(() => !cancelled && setNearby([]));
    return () => {
      cancelled = true;
    };
  }, [picked, category]);

  const confirmExisting = async (id) => {
    setError('');
    try {
      await api(`/reports/${id}/confirm`, { method: 'POST' });
      onConfirmed(id);
    } catch (err) {
      setError(err.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const created = await api('/reports', {
        method: 'POST',
        body: { category, title, description, lat: picked.lat, lng: picked.lng },
      });
      onCreated(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const showDups = picked && nearby.length > 0 && !dismissed;

  return (
    <div className="newr">
      <button className="back" onClick={onCancel}>&larr; Back to reports</button>
      <h2>Report a problem</h2>
      <p className="sub">Click the map to place it, then tell us what is wrong.</p>

      <div className={`pickbox ${picked ? '' : 'todo'}`}>
        <span>{picked ? 'Location chosen. Click the map again to move it.' : 'Click the map to show where it is.'}</span>
        <button type="button" className="btn btn-ghost" onClick={onUseLocation} disabled={locating}>
          {locating ? 'Finding you...' : 'Use my location'}
        </button>
      </div>

      <div className="cats" role="radiogroup" aria-label="What is wrong?">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={category === c}
            className={`catbtn c-${c} ${category === c ? 'on' : ''}`}
            onClick={() => setCategory(c)}
          >
            <span className={`cbadge c-${c}`}><CategoryIcon category={c} /></span>
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {error && <p className="error" style={{ margin: '0 0 12px' }}>{error}</p>}

      {showDups ? (
        <div className="dups">
          <h3>Already reported nearby</h3>
          <p className="sub">Is it one of these? Backing an existing report helps it get attention faster.</p>
          {nearby.map((r) => (
            <div className="dup" key={r.id}>
              <div>
                <b>{r.title}</b>
                <small>{r.distance_m} m away, {affected(r)} affected</small>
                <div style={{ marginTop: 4 }}><StatusPill status={r.status} /></div>
              </div>
              {r.mine ? (
                <small>Yours</small>
              ) : r.confirmed_by_me ? (
                <small>You confirmed</small>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => confirmExisting(r.id)}>
                  I have this too
                </button>
              )}
            </div>
          ))}
          <p style={{ marginTop: 6 }}>
            <button type="button" className="linkbtn" onClick={() => setDismissed(true)}>
              No, this is a different problem
            </button>
          </p>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="title">Short title</label>
            <input id="title" maxLength={120} placeholder="e.g. No water since morning"
              value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="desc">Details (optional)</label>
            <textarea id="desc" rows="3" maxLength={1000} value={description}
              onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="row">
            <button type="submit" className="btn btn-primary" disabled={busy || !picked}>
              {busy ? 'Sending...' : 'Send report'}
            </button>
            {!picked && <span className="hint" style={{ margin: 0 }}>Choose a location on the map first.</span>}
          </div>
        </form>
      )}
    </div>
  );
}