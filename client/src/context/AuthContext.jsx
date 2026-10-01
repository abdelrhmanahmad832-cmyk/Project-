import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());
  // Lets protected pages send a user who just logged out home instead of to the login page.
  const [loggedOut, setLoggedOut] = useState(false);

  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const handleAuth = ({ token, user }) => {
    setToken(token);
    setUser(user);
    setLoggedOut(false);
    return user;
  };

  const value = {
    user,
    loading,
    loggedOut,
    login: (email, password) => api('/auth/login', { method: 'POST', body: { email, password } }).then(handleAuth),
    register: (name, email, password) =>
      api('/auth/register', { method: 'POST', body: { name, email, password } }).then(handleAuth),
    setUser,
    logout: () => {
      setToken(null);
      setUser(null);
      setLoggedOut(true);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
