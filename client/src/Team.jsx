import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from './api';
import { timeAgo } from './ui';

export default function Team() {
  const { me } = useOutletContext();
  const [members, setMembers] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const isAdmin = !!me && me.role === 'admin';

  const load = () => api('/team').then(setMembers).catch((e) => setError(e.message));

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (!me) {
    return <div className="scroll"><div className="team"><p className="muted">Loading...</p></div></div>;
  }
  if (!isAdmin) {
    return (
      <div className="scroll">
        <div className="team">
          <h1>Team</h1>
          <p className="sub">Only the community admin can manage the team.</p>
        </div>
      </div>
    );
  }

  const publicUrl = `${window.location.origin}/c/${me.community_slug}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy. Select the link and copy it by hand.');
    }
  };

  const changeRole = async (id, role) => {
    setError('');
    try {
      await api(`/team/${id}/role`, { method: 'PATCH', body: { role } });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="scroll">
      <div className="team">
        <h1>Team</h1>
        <p className="sub">Choose who can update the status of reports in {me.community_name}.</p>

        {error && <p className="error">{error}</p>}

        <section className="card">
          <h2>Public status page</h2>
          <p className="sub">Anyone with this link can see what is open and what has been fixed, without an account.</p>
          <div className="linkbox">
            <input readOnly value={publicUrl} aria-label="Public page link" onFocus={(e) => e.target.select()} />
            <button className="btn btn-primary" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
        </section>

        <section className="card">
          <h2>Members</h2>
          <p className="sub">Moderators can move reports to confirmed, in progress or resolved.</p>
          <div style={{ marginTop: 8 }}>
            {members === null && <p className="muted">Loading members...</p>}
            {members && members.map((m) => (
              <div className="member" key={m.id}>
                <div>
                  <b>{m.email}</b>
                  <small>Joined {timeAgo(m.created_at)}</small>
                </div>
                {m.role === 'admin' ? (
                  <span className="rolepill">Admin</span>
                ) : (
                  <select
                    aria-label={`Role for ${m.email}`}
                    value={m.role}
                    onChange={(e) => changeRole(m.id, e.target.value)}
                  >
                    <option value="resident">Resident</option>
                    <option value="moderator">Moderator</option>
                  </select>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}