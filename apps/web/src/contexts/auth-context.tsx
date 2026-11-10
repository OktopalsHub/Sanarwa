"use client";

import { useCallback, useContext, useState } from "react";
import { createContext, type ReactNode } from "react";
import { authClient } from "@/lib/better-auth-client";

type AuthError =
  | { message: string; code: string }
  | {
      message: string;
      code: string;
      errors: Array<{ field: string; code: string; message: string }>;
    };

type AuthUser = {
  id: string;
  name?: string | null;
  email: string;
  emailVerified?: boolean | null;
  image?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  role?: string | null;
  avatar?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthError | null;
  permissions: Array<{ code: string; message: string }>;
  login: (credentials: { email: string; password: string }) => Promise<unknown>;
  register: (credentials: {
    email: string;
    password: string;
    name?: string;
    firstName?: string;
    lastName?: string;
  }) => Promise<unknown>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
  clearTokens: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const sessionState = (authClient as any).useSession() as any;
  const session = sessionState?.data ?? sessionState?.session ?? null;
  const isPending = sessionState?.isPending ?? sessionState?.isLoading ?? false;
  const [error, setError] = useState<AuthError | null>(null);
  const user = (session?.user ?? null) as AuthUser | null;

  const login = useCallback(async (credentials: { email: string; password: string }) => {
    setError(null);
    try {
      const response = (await authClient.signIn.email({
        email: credentials.email,
        password: credentials.password,
      })) as any;
      if (response?.error) throw new Error(response.error.message ?? "Login failed");
      return response?.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError({ message, code: "LOGIN_ERROR" });
      throw err;
    }
  }, []);

  const register = useCallback(
    async (credentials: {
      email: string;
      password: string;
      name?: string;
      firstName?: string;
      lastName?: string;
    }) => {
      setError(null);
      const name =
        credentials.name ||
        [credentials.firstName, credentials.lastName].filter(Boolean).join(" ").trim() ||
        credentials.email.split("@")[0];
      try {
        const response = (await (authClient.signUp as any).email({
          email: credentials.email,
          password: credentials.password,
          name,
          ...(credentials.firstName ? { firstName: credentials.firstName } : {}),
          ...(credentials.lastName ? { lastName: credentials.lastName } : {}),
        })) as any;
        if (response?.error) throw new Error(response.error.message ?? "Registration failed");
        return response?.data ?? response;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Registration failed";
        setError({ message, code: "REGISTER_ERROR" });
        throw err;
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authClient.signOut();
    } catch (err) {
      console.error("Logout error:", err);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      await (authClient as any).getSession?.();
    } catch (err) {
      console.error("Refresh user error:", err);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const clearTokens = useCallback(() => {
    void authClient.signOut();
  }, []);

  const value: AuthState = {
    user,
    isAuthenticated: !!user,
    isLoading: isPending,
    error,
    permissions: [],
    login,
    register,
    logout,
    refreshUser,
    clearError,
    clearTokens,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export { authClient };
