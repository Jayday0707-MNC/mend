import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from './api';
import MapView from './MapView';
import {
  CATEGORIES, CATEGORY_LABEL, STATUS_LABEL,
  CategoryBadge, CategoryTag, StatusPill, StatusSteps, affected, timeAgo,
} from './ui';

const SA_CENTER = [-29, 24];

function fixTime(hours) {
  if (hours === null || hours === undefined) return 'Not enough data yet';
  if (hours < 48) return `${Math.max(1, Math.round(hours))} hours`;
  return `${Math.round(hours / 24)} days`;
}

export default function PublicPage() {
  const { slug } = useParams();
  const [summary, setSummary] = useState(null);
  const [reports, setReports] = useState(null);
  const [category, setCategory] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [focus, setFocus] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/public/${slug}/summary`).then(setSummary).catch((e) => setError(e.message));
  }, [slug]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    api(`/public/${slug}/reports?${params}`).then(setReports).catch((e) => setError(e.message));
  }, [slug, category]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetail(null);
    api(`/public/${slug}/reports/${selectedId}`).then(setDetail).catch((e) => setError(e.message));
  }, [slug, selectedId]);

  if (error && !summary) {
    return (
      <div className="app">
        <header className="topbar">
          <div className="topbar-in">
            <div className="brand"><span className="brand-mark">M</span>Mend</div>
            <Link className="toplink" to="/">Log in</Link>
          </div>
        </header>
        <div className="scroll">
          <div className="team">
            <h1>We could not find that community</h1>
            <p className="sub">{error}. Check the link and try again.</p>
          </div>
        </div>
      </div>
    );
  }

  const c = summary?.community;
  const hasCentre = c && c.center_lat != null && c.center_lng != null;
  const center = hasCentre ? [Number(c.center_lat), Number(c.center_lng)] : SA_CENTER;
  const open = summary ? summary.counts.reported + summary.counts.confirmed + summary.counts.in_progress : 0;

  const select = (id) => {
    const r = (reports || []).find((x) => x.id === id);
    setSelectedId(id);
    if (r) setFocus({ lat: Number(r.lat), lng: Number(r.lng) });
  };

  const events = detail
    ? [
        { key: 'created', label: 'Reported', at: detail.created_at, note: null },
        ...detail.updates.map((u, i) => ({
          key: `u${i}`,
          label: STATUS_LABEL[u.new_status] || u.new_status,
          at: u.created_at,
          note: u.note,
        })),
      ]
    : [];

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-in">
          <div className="topbar-left">
            <div className="brand"><span className="brand-mark">M</span>Mend</div>
            {c && <div className="comm"><b>{c.name}</b></div>}
          </div>
          <Link className="toplink" to="/">Log in to report a problem</Link>
        </div>
      </header>

      <div className="pub-stats">
        <div className="stat"><b>{summary ? open : '-'}</b><small>Open problems</small></div>
        <div className="stat"><b>{summary ? summary.counts.in_progress : '-'}</b><small>Being fixed now</small></div>
        <div className="stat"><b>{summary ? summary.resolvedLast30 : '-'}</b><small>Fixed in the last 30 days</small></div>
        <div className="stat"><b>{summary ? fixTime(summary.avgResolveHours) : '-'}</b><small>Typical time to fix</small></div>
      </div>

      <div className="workspace">
        <aside className="side">
          {selectedId ? (
            <div className="detail">
              <button className="back" onClick={() => setSelectedId(null)}>&larr; All reports</button>
              {!detail ? (
                <p className="muted">Loading report...</p>
              ) : (
                <>
                  <div className="d-head">
                    <CategoryBadge category={detail.category} large />
                    <div>
                      <h2>{detail.title}</h2>
                      <div className="d-meta">
                        <span>{CATEGORY_LABEL[detail.category]}</span>
                        <span>Reported {timeAgo(detail.created_at)}</span>
                        <span>{affected(detail)} {affected(detail) === 1 ? 'person' : 'people'} affected</span>
                      </div>
                    </div>
                  </div>
                  <StatusSteps status={detail.status} />
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
                </>
              )}
            </div>
          ) : (
            <>
              <div className="side-head">
                <div>
                  <h1>Status</h1>
                  <p className="sub">Open problems and recent fixes.</p>
                </div>
              </div>
              <div className="filters">
                <div className="chips">
                  <button className={`chip ${category === '' ? 'on' : ''}`} onClick={() => setCategory('')}>All</button>
                  {CATEGORIES.map((cat) => (
                    <button key={cat} className={`chip c-${cat} ${category === cat ? 'on' : ''}`} onClick={() => setCategory(cat)}>
                      <i />
                      {CATEGORY_LABEL[cat]}
                    </button>
                  ))}
                </div>
              </div>

              {reports === null && <div className="empty">Loading reports...</div>}
              {reports && reports.length === 0 && (
                <div className="empty">
                  <strong>Nothing reported right now</strong>
                  {category ? 'Try a different category.' : 'No open problems in this community.'}
                </div>
              )}
              {reports && reports.map((r) => (
                <button key={r.id} className="rcard" onClick={() => select(r.id)}>
                  <CategoryBadge category={r.category} />
                  <div>
                    <h3>{r.title}</h3>
                    <div className="rmeta">
                      <StatusPill status={r.status} />
                      <span>{timeAgo(r.created_at)}</span>
                    </div>
                  </div>
                  <div className="affected">
                    <b>{affected(r)}</b>
                    <small>affected</small>
                  </div>
                </button>
              ))}
              <p className="pub-note">
                Locations are approximate to protect people's privacy. Reports are written by residents.
              </p>
            </>
          )}
        </aside>

        <section className="mapcol">
          {summary && (
            <MapView
              reports={reports || []}
              center={center}
              zoom={hasCentre ? 14 : 5}
              fit={!hasCentre}
              picking={false}
              picked={null}
              onPick={() => {}}
              selectedId={selectedId}
              onSelect={select}
              focus={focus}
            />
          )}
          <div className="map-legend">
            {CATEGORIES.map((cat) => <CategoryTag key={cat} category={cat} />)}
          </div>
        </section>
      </div>
    </div>
  );
}