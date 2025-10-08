import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { saveAuthCacheToDB, loadAuthCacheFromDB, removeAuthCacheFromDB, migrateLocalStorageCacheToDB } from '../lib/authCache';
import sync from '../lib/sync';

async function sha256Hex(message: string) {
  const enc = new TextEncoder();
  const data = enc.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function genSalt(len = 16) {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
}

// legacy CachedAuth type was moved into the Dexie auth cache helper

// The local storage helpers have been replaced by Dexie-backed functions in src/lib/authCache.ts

type AuthContextType = {
  user: User | null;
  loading: boolean;
  // returns true when the sign-in was satisfied from the local cache (offline)
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  // metadata about cached auth (if any)
  getCachedAuthInfo: () => Promise<{ email: string; cachedAt: string } | null>;
  // try to revalidate existing cached credentials online and refresh the cache
  revalidateOnline: (password: string) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: any;
    const init = async () => {
  // migrate any legacy localStorage cache into Dexie (non-blocking)
  try { await migrateLocalStorageCacheToDB('vision_auth_cache'); } catch (e) { /* ignore */ }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          setLoading(false);
        } else {
          // try cached user from Dexie when offline
          const cached = await loadAuthCacheFromDB();
          if (cached && cached.user) setUser(cached.user as any);
          setLoading(false);
        }
      } catch (e) {
        const cached = await loadAuthCacheFromDB();
        if (cached && cached.user) setUser(cached.user as any);
        setLoading(false);
      }
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });
      unsub = data.subscription;
    };
    init();

    return () => { if (unsub) unsub.unsubscribe(); };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // on success, cache user and salted hash for offline
      const salt = genSalt();
      const passHash = await sha256Hex(salt + password);
  await saveAuthCacheToDB({ id: 'primary', user: data.user, email, passHash, salt, cachedAt: new Date().toISOString() });
      setUser(data.user ?? null);
      // attempt a quick sync now that we're online
      try { await sync.pushLocalHistoryToServer(data.user?.id); await sync.pullServerItemsIntoLocal(data.user?.id); } catch (e) {}
      return false; // online sign-in (not offline)
    } catch (e: any) {
      // If network error, try offline validation against cached credentials
      const cached = await loadAuthCacheFromDB();
      if (cached && cached.email === email) {
        const test = await sha256Hex((cached.salt || '') + password);
        if (test === cached.passHash) {
          setUser(cached.user as any);
          return true; // offline sign-in used cached creds
        }
      }
      throw e;
    }
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    // cache newly created user for offline
    const salt = genSalt();
    const passHash = await sha256Hex(salt + password);
    await saveAuthCacheToDB({ id: 'primary', user: data.user, email, passHash, salt, cachedAt: new Date().toISOString() });
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    // clear cached user on sign out
    try { await removeAuthCacheFromDB(); } catch (e) { /* ignore */ }
  };

  const getCachedAuthInfo = async () => {
    try {
      const cached = await loadAuthCacheFromDB();
      if (!cached) return null;
      return { email: cached.email, cachedAt: cached.cachedAt };
    } catch (e) { return null; }
  };

  const revalidateOnline = async (password: string) => {
    try {
      const cached = await loadAuthCacheFromDB();
      if (!cached) return false;
      // attempt online sign-in with cached email and provided password
      const { data, error } = await supabase.auth.signInWithPassword({ email: cached.email, password });
      if (error) return false;
      // refresh cache with fresh user and new salt/hash
      const salt = genSalt();
      const passHash = await sha256Hex(salt + password);
      await saveAuthCacheToDB({ id: 'primary', user: data.user, email: cached.email, passHash, salt, cachedAt: new Date().toISOString() });
      setUser(data.user ?? null);
      return true;
    } catch (e) {
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, getCachedAuthInfo, revalidateOnline }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
