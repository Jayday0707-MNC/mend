import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { getToken, clearToken } from './api';
import AuthPage from './AuthPage';
import Layout from './Layout';
import Reports from './Reports';
import Team from './Team';
import PublicPage from './PublicPage';

function AuthedApp({ onLogout }) {
  return (
    <Routes>
      <Route element={<Layout onLogout={onLogout} />}>
        <Route index element={<Reports />} />
        <Route path="team" element={<Team />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!getToken());

  const logout = () => {
    clearToken();
    setLoggedIn(false);
  };

  return (
    <Routes>
      <Route path="/c/:slug" element={<PublicPage />} />
      <Route
        path="/*"
        element={loggedIn ? <AuthedApp onLogout={logout} /> : <AuthPage onLogin={() => setLoggedIn(true)} />}
      />
    </Routes>
  );
}