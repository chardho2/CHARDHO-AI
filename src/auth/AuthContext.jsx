import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | anonymous | authenticated | twofa
  const [twoFactor, setTwoFactor] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const { user: current } = await api.get('/auth/me');
      setUser(current);
      if (current && current.requires2fa && !current.twofaVerified) {
        // The password step succeeded but the second factor has not been provided yet.
        setTwoFactor({ required: true, state: current.totpEnabled ? 'verify' : 'enrol' });
        setStatus('twofa');
      } else {
        setTwoFactor(null);
        setStatus(current ? 'authenticated' : 'anonymous');
      }
      return current;
    } catch {
      setUser(null);
      setStatus('anonymous');
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setUser(res.user);
    if (res.twoFactor?.required) {
      setTwoFactor(res.twoFactor);
      setStatus('twofa');
      return res;
    }
    setStatus('authenticated');
    setTwoFactor(null);
    return res;
  }, []);

  const verifyTwoFactor = useCallback(async (code) => {
    const res = await api.post('/auth/2fa/verify', { code });
    setUser(res.user);
    setTwoFactor(null);
    setStatus('authenticated');
    return res;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
      setTwoFactor(null);
      setStatus('anonymous');
    }
  }, []);

  const register = useCallback(
    (payload) => api.post('/auth/register', payload),
    [],
  );

  const can = useCallback(
    (...permissions) => {
      if (!user) return false;
      if (user.role === 'founder') return true;
      return permissions.some((p) => user.permissions?.includes(p));
    },
    [user],
  );

  const value = useMemo(
    () => ({ user, status, twoFactor, login, logout, register, refresh, verifyTwoFactor, can }),
    [user, status, twoFactor, login, logout, register, refresh, verifyTwoFactor, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
