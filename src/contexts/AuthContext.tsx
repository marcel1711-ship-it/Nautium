import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User } from '../types';
import { demoUsers } from '../data/demoData';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  currentUser: User | null;
  user: any;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  selectedVesselId: string | null;
  setSelectedVesselId: (vesselId: string) => void;
  sessionReady: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [user, setUser] = useState<any>(null);
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    const storedUser = localStorage.getItem('currentUser');
    const storedVesselId = localStorage.getItem('selectedVesselId');

    if (storedUser) {
      let parsedUser = JSON.parse(storedUser);

      // Re-sync demo users from demoData to pick up any ID updates
      const freshDemoUser = demoUsers.find(u => u.email === parsedUser.email);
      if (freshDemoUser) {
        parsedUser = freshDemoUser;
        localStorage.setItem('currentUser', JSON.stringify(parsedUser));
        if (parsedUser.vessel_ids.length > 0) {
          localStorage.setItem('selectedVesselId', parsedUser.vessel_ids[0]);
        }
      }

      const applyUserState = (sessionUser: any) => {
        setUser(sessionUser);

        // FIX: leer rol solo de app_metadata (solo escribible por service role),
        // nunca de user_metadata (modificable por el cliente).
        if (sessionUser && !freshDemoUser) {
          const freshRole = sessionUser.app_metadata?.role;
          if (freshRole && freshRole !== parsedUser.role) {
            parsedUser = { ...parsedUser, role: freshRole };
            localStorage.setItem('currentUser', JSON.stringify(parsedUser));
          }
        }

        setCurrentUser(parsedUser);

        const effectiveStoredVesselId = localStorage.getItem('selectedVesselId');
        if (effectiveStoredVesselId) {
          const validVesselId = parsedUser.vessel_ids.includes(effectiveStoredVesselId)
            ? effectiveStoredVesselId
            : parsedUser.vessel_ids[0] || null;
          setSelectedVesselId(validVesselId);
          if (validVesselId) localStorage.setItem('selectedVesselId', validVesselId);
        } else if (parsedUser.vessel_ids.length > 0) {
          setSelectedVesselId(parsedUser.vessel_ids[0]);
          localStorage.setItem('selectedVesselId', parsedUser.vessel_ids[0]);
        }

        setSessionReady(true);
      };

      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          applyUserState(session.user);
        } else if (freshDemoUser) {
          // FIX: solo intentar re-login con demo123 si es un usuario demo confirmado.
          // Nunca usar demo123 para re-autenticar usuarios reales.
          supabase.auth.signInWithPassword({
            email: parsedUser.email,
            password: 'demo123',
          }).then(({ data, error }) => {
            if (!error && data?.user) {
              applyUserState(data.user);
            } else {
              localStorage.removeItem('currentUser');
              localStorage.removeItem('selectedVesselId');
              setSessionReady(true);
            }
          });
        } else {
          // Usuario real sin sesión activa — forzar re-login limpio.
          localStorage.removeItem('currentUser');
          localStorage.removeItem('selectedVesselId');
          setSessionReady(true);
        }
      });
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setSessionReady(true);
      });
    }

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const normalizedEmail = email.toLowerCase().trim();

    const demoUser = demoUsers.find(u => u.email === normalizedEmail && u.status === 'active');
    if (demoUser && password === 'demo123') {
      const { data: signInData, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (authError) {
        console.warn('[Auth] demo signIn failed:', authError.message, 'for', normalizedEmail);
      }

      if (signInData?.user) {
        setUser(signInData.user);
      }

      setCurrentUser(demoUser);
      setSessionReady(true);
      localStorage.setItem('currentUser', JSON.stringify(demoUser));

      if (demoUser.vessel_ids.length > 0 && demoUser.role !== 'master_admin') {
        setSelectedVesselId(demoUser.vessel_ids[0]);
        localStorage.setItem('selectedVesselId', demoUser.vessel_ids[0]);
      }

      return true;
    }

    const { data: signInData, error: authError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (authError || !signInData.user) return false;

    const supabaseUser = signInData.user;
    // FIX: rol solo de app_metadata, nunca de user_metadata.
    const role = supabaseUser.app_metadata?.role || 'standard_user';
    const companyId = supabaseUser.app_metadata?.company_id
      || supabaseUser.user_metadata?.company_id
      || '';

    let vesselIds: string[] = supabaseUser.user_metadata?.vessel_ids || [];

    if (companyId && vesselIds.length === 0) {
      const { data: vessels } = await supabase
        .from('vessels')
        .select('id')
        .eq('company_id', companyId);
      if (vessels) vesselIds = vessels.map((v: { id: string }) => v.id);
    }

    const realUser: User = {
      id: supabaseUser.id,
      company_id: companyId,
      email: supabaseUser.email || normalizedEmail,
      full_name: supabaseUser.user_metadata?.full_name || supabaseUser.email || '',
      phone: supabaseUser.user_metadata?.phone || '',
      role,
      status: 'active',
      vessel_ids: vesselIds,
      created_at: supabaseUser.created_at,
    };

    setUser(supabaseUser);
    setCurrentUser(realUser);
    setSessionReady(true);
    localStorage.setItem('currentUser', JSON.stringify(realUser));

    if (vesselIds.length > 0 && role !== 'master_admin') {
      const stored = localStorage.getItem('selectedVesselId');
      if (!stored) {
        setSelectedVesselId(vesselIds[0]);
        localStorage.setItem('selectedVesselId', vesselIds[0]);
      }
    }

    return true;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setSessionReady(false);
    setUser(null);
    setSelectedVesselId(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('selectedVesselId');
  };

  // FIX: rechazar 'all' — no es un UUID válido y rompe queries en Supabase.
  // El valor 'all' se maneja solo en el Header/Sidebar para el selector visual;
  // los componentes que necesitan un vessel_id real usan el guard en App.tsx.
  const handleSetSelectedVesselId = (vesselId: string) => {
    setSelectedVesselId(vesselId);
    if (vesselId !== 'all') {
      localStorage.setItem('selectedVesselId', vesselId);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        user,
        login,
        logout,
        isAuthenticated: !!currentUser,
        selectedVesselId,
        setSelectedVesselId: handleSetSelectedVesselId,
        sessionReady,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
