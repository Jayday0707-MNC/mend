import { useEffect, useState } from 'react';
import { api, setToken } from './api';
import { CategoryBadge, StatusPill } from './ui';

const SAMPLES = [
  { category: 'water', title: 'Burst pipe near the school gate', note: '7 people affected', status: 'in_progress' },
  { category: 'pothole', title: 'Deep pothole on the taxi route', note: '4 people affected', status: 'confirmed' },
  { category: 'power', title: 'Street dark since Tuesday', note: '1 person affected', status: 'reported' },
];

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login'); // login | join | create
  const [communities, setCommunities] = useState([]);
  const [slug, setSlug] = useState('');
  const [communityName, setCommunityName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== 'join') return;
    api('/communities')
      .then((list) => {
        setCommunities(list);
        if (list[0]) setSlug((s) => s || list[0].slug);
      })
      .catch((e) => setError(e.message));
  }, [mode]);

  const switchMode = (m) => {
    setMode(m);
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      let path, body;
      if (mode === 'login') {
        path = '/auth/login';
        body = { email, password };
      } else if (mode === 'join') {
        path = '/auth/register';
        body = { communitySlug: slug, email, password };
      } else {
        path = '/auth/register-community';
        body = { communityName, email, password };
      }
      const data = await api(path, { method: 'POST', body });
      setToken(data.token);
      onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const labels = { login: 'Log in', join: 'Join community', create: 'Start community' };
  const titles = { login: 'Welcome back', join: 'Join your community', create: 'Start a community' };

  return (
    <div className="auth">
      <section className="auth-hero">
        <div className="brand">
          <span className="brand-mark">M</span>
          Mend
        </div>
        <div>
          <h2>Report it once. Neighbours back it up. See it get fixed.</h2>
          <p>One place for your community to report water, power and road problems, and to follow each one until it is resolved.</p>
        </div>
        <div className="sample" aria-hidden="true">
          {SAMPLES.map((s) => (
            <div className="sample-row" key={s.title}>
              <CategoryBadge category={s.category} />
              <div>
                <b>{s.title}</b>
                <small>{s.note}</small>
              </div>
              <StatusPill status={s.status} />
            </div>
          ))}
        </div>
      </section>

      <section className="auth-main">
        <form className="auth-form" onSubmit={submit}>
          <h1>{titles[mode]}</h1>

          <div className="tabs" role="tablist">
            <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => switchMode('login')}>Log in</button>
            <button type="button" className={mode === 'join' ? 'on' : ''} onClick={() => switchMode('join')}>Join a community</button>
            <button type="button" className={mode === 'create' ? 'on' : ''} onClick={() => switchMode('create')}>Start one</button>
          </div>

          {mode === 'join' && (
            <div className="field">
              <label htmlFor="community">Your community</label>
              <select id="community" value={slug} onChange={(e) => setSlug(e.target.value)} required>
                {communities.length === 0 && <option value="">No communities yet</option>}
                {communities.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
              </select>
              {communities.length === 0 && <p className="hint">Nobody has started one yet. Use "Start one" first.</p>}
            </div>
          )}
          {mode === 'create' && (
            <div className="field">
              <label htmlFor="cname">Community name</label>
              <input id="cname" placeholder="e.g. Mbombela Ward 12" value={communityName}
                onChange={(e) => setCommunityName(e.target.value)} required />
              <p className="hint">You will be its admin and can update the status of reports.</p>
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" minLength={mode === 'login' ? undefined : 8}
              value={password} onChange={(e) => setPassword(e.target.value)} required />
            {mode !== 'login' && <p className="hint">At least 8 characters.</p>}
          </div>

          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Please wait...' : labels[mode]}
          </button>
        </form>
      </section>
    </div>
  );
}