import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { subscribeToAuthChanges, type User } from '@/lib/auth';

const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Starts true so the Account screen can show a neutral loading state
  // instead of flashing "signed out" before Firebase restores a persisted
  // session on launch.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return subscribeToAuthChanges((nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
