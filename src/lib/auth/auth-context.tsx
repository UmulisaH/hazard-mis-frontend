'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { apiClient } from '@/lib/api/client';
import { clearAuthStorage, readAccessToken, writeAccessToken } from './session';
import { decodeJwtPayload, isJwtExpired } from './jwt';
import type {
  AppRole,
  AuthResponse,
  AuthenticatedUser,
  CurrentUserProfile,
  DecodedJwtPayload,
} from './types';

interface AuthState {
  token: string | null;
  decodedToken: DecodedJwtPayload | null;
  role: AppRole | null;
  profile: CurrentUserProfile | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
}

interface AuthContextValue extends AuthState {
  currentUser: AuthenticatedUser | null;
  setSessionFromAuthResponse: (response: AuthResponse) => void;
  clearSession: () => void;
  logout: () => void;
  hydrateProfile: (profile: CurrentUserProfile | null) => void;
}

const initialState: AuthState = {
  token: null,
  decodedToken: null,
  role: null,
  profile: null,
  isAuthenticated: false,
  isBootstrapping: true,
};

const AuthContext = createContext<AuthContextValue | null>(null);

function buildStateFromToken(
  token: string,
  profile: CurrentUserProfile | null = null,
): AuthState {
  const decodedToken = decodeJwtPayload(token);

  if (!decodedToken || isJwtExpired(decodedToken)) {
    return initialState;
  }

  return {
    token,
    decodedToken,
    role: decodedToken.role,
    profile,
    isAuthenticated: true,
    isBootstrapping: false,
  };
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>(initialState);

  const clearSession = useCallback(() => {
    clearAuthStorage();
    setState({ ...initialState, isBootstrapping: false });
  }, []);

  const hydrateProfile = useCallback((profile: CurrentUserProfile | null) => {
    setState((currentState) => ({
      ...currentState,
      profile,
    }));
  }, []);

  const setSessionFromAuthResponse = useCallback((response: AuthResponse) => {
    writeAccessToken(response.access_token);

    const nextState = buildStateFromToken(
      response.access_token,
      response.employee,
    );
    setState({
      ...nextState,
      isBootstrapping: false,
    });
  }, []);

  const logout = useCallback(() => {
    clearAuthStorage();
    setState({ ...initialState, isBootstrapping: false });
    router.replace('/login');
  }, [router]);

  useEffect(() => {
    let active = true;

    async function bootstrapAuth() {
      const token = readAccessToken();

      if (!token) {
        if (active) {
          setState({ ...initialState, isBootstrapping: false });
        }

        return;
      }

      const decodedToken = decodeJwtPayload(token);

      if (!decodedToken || isJwtExpired(decodedToken)) {
        clearAuthStorage();

        if (active) {
          setState({ ...initialState, isBootstrapping: false });
        }

        return;
      }

      if (active) {
        setState({
          token,
          decodedToken,
          role: decodedToken.role,
          profile: null,
          isAuthenticated: true,
          isBootstrapping: true,
        });
      }

      try {
        const response = await apiClient.get<CurrentUserProfile>('/users/me');

        if (active) {
          setState((currentState) => ({
            ...currentState,
            profile: response.data,
            isBootstrapping: false,
          }));
        }
      } catch {
        if (active) {
          setState((currentState) => ({
            ...currentState,
            isBootstrapping: false,
          }));
        }
      }
    }

    void bootstrapAuth();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const currentUser = state.decodedToken
      ? {
          id: state.decodedToken.sub,
          email: state.decodedToken.email,
          role: state.decodedToken.role,
        }
      : null;

    return {
      ...state,
      currentUser,
      setSessionFromAuthResponse,
      clearSession,
      logout,
      hydrateProfile,
    };
  }, [clearSession, hydrateProfile, logout, setSessionFromAuthResponse, state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
