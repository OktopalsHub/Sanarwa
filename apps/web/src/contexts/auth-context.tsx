"use client";

import { authApi } from "@/lib/api/auth";
import {
  AuthError,
  AuthResponse,
  AuthState,
  AuthUser,
  LoginCredentials,
  RegisterCredentials,
} from "@/lib/types/auth";
import React, { createContext, useCallback, useContext, useEffect, useReducer } from "react";

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  register: (credentials: RegisterCredentials) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthAction =
  | { type: "AUTH_START" }
  | { type: "AUTH_SUCCESS"; payload: AuthUser }
  | { type: "AUTH_ERROR"; payload: AuthError }
  | { type: "AUTH_LOGOUT" }
  | { type: "CLEAR_ERROR" };

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  permissions: [],
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "AUTH_START":
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case "AUTH_SUCCESS":
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case "AUTH_ERROR":
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };
    case "AUTH_LOGOUT":
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    case "CLEAR_ERROR":
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      dispatch({ type: "AUTH_START" });
      const response = await authApi.login(credentials);
      const authUser: AuthUser = {
        ...response.user,
        name: `${response.user.firstName} ${response.user.lastName}`.trim(),
      };
      dispatch({ type: "AUTH_SUCCESS", payload: authUser });

      // Log successful login (fire and forget)
      try {
        const { auditLogger } = await import("@/lib/services/audit-logger");
        auditLogger.logLogin();
      } catch (auditError) {
        console.error("Failed to log login audit entry:", auditError);
      }

      return response;
    } catch (error) {
      dispatch({
        type: "AUTH_ERROR",
        payload: {
          message: error instanceof Error ? error.message : "Login failed",
          code: "LOGIN_ERROR",
        },
      });
      throw error;
    }
  }, []);

  const register = useCallback(async (credentials: RegisterCredentials) => {
    try {
      dispatch({ type: "AUTH_START" });
      const response = await authApi.register(credentials);
      const authUser: AuthUser = {
        ...response.user,
        name: `${response.user.firstName} ${response.user.lastName}`.trim(),
      };
      dispatch({ type: "AUTH_SUCCESS", payload: authUser });

      return response;
    } catch (error) {
      dispatch({
        type: "AUTH_ERROR",
        payload: {
          message: error instanceof Error ? error.message : "Registration failed",
          code: "REGISTER_ERROR",
        },
      });
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      // Log logout before actually logging out
      try {
        const { auditLogger } = await import("@/lib/services/audit-logger");
        auditLogger.logLogout();
      } catch (auditError) {
        console.error("Failed to log logout audit entry:", auditError);
      }

      await authApi.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      dispatch({ type: "AUTH_LOGOUT" });
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      dispatch({ type: "AUTH_START" });
      const user = await authApi.getCurrentUser();
      const authUser: AuthUser = {
        ...user,
        name: `${user.firstName} ${user.lastName}`.trim(),
      };
      dispatch({ type: "AUTH_SUCCESS", payload: authUser });
    } catch {
      dispatch({ type: "AUTH_LOGOUT" });
    }
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  // Initialize authentication state on mount
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    refreshUser,
    clearError,
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
