import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from './api';
import MapView from './MapView';
import NewReport from './NewReport';
import ReportDetail from './ReportDetail';
import {
  CATEGORIES, CATEGORY_LABEL, STATUSES, STATUS_LABEL,
  CategoryBadge, CategoryTag, StatusPill, affected, timeAgo,
} from './ui';

const SA_CENTER = [-29, 24];

export default function Reports() {
  const { me } = useOutletContext();
  const [reports, setReports] = useState(null);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');

  const [mode, setMode] = useState('browse'); // browse | new
  const [selectedId, setSelectedId] = useState(null);
  const [picked, setPicked] = useState(null);
  const [focus, setFocus] = useState(null);
  const [locating, setLocating] = useState(false);

  const refresh = () => setReload((n) => n + 1);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (status) params.set('status', status);
    api(`/reports?${params}`).then(setReports).catch((e) => setError(e.message));
  }, [category, status, reload]);

  const hasCentre = me && me.center_lat != null && me.center_lng != null;
  const center = hasCentre ? [Number(me.center_lat), Number(me.center_lng)] : SA_CENTER;
  const zoom = hasCentre ? 14 : 5;

  const select = (r) => {
    setMode('browse');
    setSelectedId(r.id);
    setFocus({ lat: Number(r.lat), lng: Number(r.lng) });
  };

  const selectById = (id) => {
    const r = (reports || []).find((x) => x.id === id);
    if (r) select(r);
    else {
      setMode('browse');
      setSelectedId(id);
    }
  };

  const startNew = () => {
    setError('');
    setPicked(null);
    setSelectedId(null);
    setMode('new');
  };

  const cancelNew = () => {
    setPicked(null);
    setMode('browse');
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Your browser cannot share its location. Click the map instead.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const spot = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPicked(spot);
        setFocus(spot);
        setLocating(false);
      },
      () => {
        setError('Could not get your location. Click the map instead.');
        setLocating(false);
      }
    );
  };

  const onCreated = (created) => {
    setPicked(null);
    refresh();
    select(created);
  };

  const onConfirmed = (id) => {
    setPicked(null);
    refresh();
    selectById(id);
  };

  return (
    <div className="workspace">
      <aside className="side">
        {mode === 'new' ? (
          <NewReport
            picked={picked}
            locating={locating}
            onUseLocation={useMyLocation}
            onCancel={cancelNew}
            onCreated={onCreated}
            onConfirmed={onConfirmed}
          />
        ) : selectedId ? (
          <ReportDetail
            id={selectedId}
            me={me}
            onBack={() => setSelectedId(null)}
            onChanged={refresh}
          />
        ) : (
          <>
            <div className="side-head">
              <div>
                <h1>Reports</h1>
                <p className="sub">
                  {reports ? `${reports.length} in ${me ? me.community_name : 'your community'}` : 'Loading...'}
                </p>
              </div>
              <button className="btn btn-primary" onClick={startNew}>Report a problem</button>
            </div>

            {error && <p className="error">{error}</p>}

            <div className="filters">
              <div className="chips">
                <button className={`chip ${category === '' ? 'on' : ''}`} onClick={() => setCategory('')}>All</button>
                {CATEGORIES.map((c) => (
                  <button key={c} className={`chip c-${c} ${category === c ? 'on' : ''}`} onClick={() => setCategory(c)}>
                    <i />
                    {CATEGORY_LABEL[c]}
                  </button>
                ))}
              </div>
              <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Any status</option>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>

            {reports === null && <div className="empty">Loading reports...</div>}
            {reports && reports.length === 0 && (
              <div className="empty">
                <strong>No reports here</strong>
                {category || status ? 'Try a different filter.' : 'Be the first to report a problem in your area.'}
              </div>
            )}
            {reports && reports.map((r) => (
              <button
                key={r.id}
                className={`rcard ${selectedId === r.id ? 'sel' : ''}`}
                onClick={() => select(r)}
              >
                <CategoryBadge category={r.category} />
                <div>
                  <h3>{r.title}</h3>
                  <div className="rmeta">
                    <StatusPill status={r.status} />
                    <span>{timeAgo(r.created_at)}</span>
                    {r.mine && <span>Yours</span>}
                  </div>
                </div>
                <div className="affected">
                  <b>{affected(r)}</b>
                  <small>affected</small>
                </div>
              </button>
            ))}
          </>
        )}
        {mode === 'new' && error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}
      </aside>

      <section className="mapcol">
        {me && (
          <MapView
            reports={reports || []}
            center={center}
            zoom={zoom}
            fit={!hasCentre}
            picking={mode === 'new'}
            picked={picked}
            onPick={(lat, lng) => setPicked({ lat, lng })}
            selectedId={selectedId}
            onSelect={selectById}
            focus={focus}
          />
        )}
        {mode === 'new' && !picked && <div className="map-banner">Click the map to place the problem</div>}
        <div className="map-legend">
          {CATEGORIES.map((c) => <CategoryTag key={c} category={c} />)}
        </div>
      </section>
    </div>
  );
}