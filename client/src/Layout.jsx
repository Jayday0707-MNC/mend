import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { api } from './api';

export default function Layout({ onLogout }) {
  const [me, setMe] = useState(null);

  useEffect(() => {
    api('/auth/me').then(setMe).catch(() => {});
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-in">
          <div className="topbar-left">
            <div className="brand">
              <span className="brand-mark">M</span>
              Mend
            </div>
            <nav className="topnav">
              <NavLink to="/" end>Reports</NavLink>
              {me && me.role === 'admin' && <NavLink to="/team">Team</NavLink>}
              {me && (
                <a href={`/c/${me.community_slug}`} target="_blank" rel="noreferrer">Public page</a>
              )}
            </nav>
          </div>
          <div className="comm">
            {me && (
              <div>
                <b>{me.community_name}</b>
                <small>{me.role}</small>
              </div>
            )}
            <button className="btn btn-ghost" onClick={onLogout}>Log out</button>
          </div>
        </div>
      </header>
      <Outlet context={{ me }} />
    </div>
  );
}