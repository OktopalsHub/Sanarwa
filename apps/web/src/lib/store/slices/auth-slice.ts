import { authApi } from '@/lib/api/auth';
import type {
  AuthError,
  LoginCredentials,
  RegisterData,
  SessionInfo,
  User
} from '@/lib/types/auth';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface AuthState {
  // User and authentication status
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthError | null;

  // Token management
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;

  // Permissions and roles
  permissions: string[];
  currentTenantId: string | null;

  // Session management
  sessionInfo: SessionInfo | null;

  // UI state
  isLoginModalOpen: boolean;
  isRegistrationModalOpen: boolean;
  redirectAfterLogin: string | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  accessToken: null,
  refreshToken: null,
  tokenExpiresAt: null,
  permissions: [],
  currentTenantId: null,
  sessionInfo: null,
  isLoginModalOpen: false,
  isRegistrationModalOpen: false,
  redirectAfterLogin: null,
};

// Async thunks for authentication actions
export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const response = await authApi.login(credentials);
      return response;
    } catch (error: any) {
      return rejectWithValue({
        message: error.message || 'Login failed',
        code: error.code || 'LOGIN_ERROR',
        statusCode: error.statusCode || 401,
      } as AuthError);
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/register',
  async (userData: RegisterData, { rejectWithValue }) => {
    try {
      const response = await authApi.register(userData);
      return response;
    } catch (error: any) {
      return rejectWithValue({
        message: error.message || 'Registration failed',
        code: error.code || 'REGISTRATION_ERROR',
        statusCode: error.statusCode || 400,
      } as AuthError);
    }
  }
);

export const refreshAuthToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState };
      if (!state.auth.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await authApi.refreshToken();
      return response;
    } catch (error: any) {
      return rejectWithValue({
        message: error.message || 'Token refresh failed',
        code: error.code || 'TOKEN_REFRESH_ERROR',
        statusCode: error.statusCode || 401,
      } as AuthError);
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authApi.logout();
    } catch (error: any) {
      // Even if logout fails on server, we should clear local state
      console.warn('Logout API call failed:', error);
    }
  }
);

export const getCurrentUser = createAsyncThunk(
  'auth/getCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const user = await authApi.getCurrentUser();
      return user;
    } catch (error: any) {
      return rejectWithValue({
        message: error.message || 'Failed to get current user',
        code: error.code || 'GET_USER_ERROR',
        statusCode: error.statusCode || 401,
      } as AuthError);
    }
  }
);

export const verifyEmail = createAsyncThunk(
  'auth/verifyEmail',
  async (token: string, { rejectWithValue }) => {
    try {
      await authApi.verifyEmail({ token });
      return { success: true };
    } catch (error: any) {
      return rejectWithValue({
        message: error.message || 'Email verification failed',
        code: error.code || 'EMAIL_VERIFICATION_ERROR',
        statusCode: error.statusCode || 400,
      } as AuthError);
    }
  }
);

export const requestPasswordReset = createAsyncThunk(
  'auth/requestPasswordReset',
  async (email: string, { rejectWithValue }) => {
    try {
      await authApi.requestPasswordReset({ email });
      return { success: true };
    } catch (error: any) {
      return rejectWithValue({
        message: error.message || 'Password reset request failed',
        code: error.code || 'PASSWORD_RESET_REQUEST_ERROR',
        statusCode: error.statusCode || 400,
      } as AuthError);
    }
  }
);

export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async ({ token, password }: { token: string; password: string }, { rejectWithValue }) => {
    try {
      await authApi.confirmPasswordReset({ token, password, confirmPassword: password });
      return { success: true };
    } catch (error: any) {
      return rejectWithValue({
        message: error.message || 'Password reset failed',
        code: error.code || 'PASSWORD_RESET_ERROR',
        statusCode: error.statusCode || 400,
      } as AuthError);
    }
  }
);

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  selectors: {
    selectUser: (state) => state.user,
    selectIsAuthenticated: (state) => state.isAuthenticated,
    selectPermissions: (state) => state.permissions,
  },
  reducers: {
    // Token management
    setTokens: (state, action: PayloadAction<{ accessToken: string; refreshToken: string; expiresIn: number }>) => {
      const { accessToken, refreshToken, expiresIn } = action.payload;
      state.accessToken = accessToken;
      state.refreshToken = refreshToken;
      state.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
    },

    clearTokens: (state) => {
      state.accessToken = null;
      state.refreshToken = null;
      state.tokenExpiresAt = null;
    },

    // Permission management
    setPermissions: (state, action: PayloadAction<string[]>) => {
      state.permissions = action.payload;
    },

    addPermission: (state, action: PayloadAction<string>) => {
      if (!state.permissions.includes(action.payload)) {
        state.permissions.push(action.payload);
      }
    },

    removePermission: (state, action: PayloadAction<string>) => {
      state.permissions = state.permissions.filter(p => p !== action.payload);
    },

    clearPermissions: (state) => {
      state.permissions = [];
    },

    // Tenant context
    setCurrentTenantId: (state, action: PayloadAction<string | null>) => {
      state.currentTenantId = action.payload;
    },

    // Session management
    setSessionInfo: (state, action: PayloadAction<SessionInfo>) => {
      state.sessionInfo = action.payload;
    },

    clearSessionInfo: (state) => {
      state.sessionInfo = null;
    },

    // UI state management
    openLoginModal: (state, action: PayloadAction<string | null>) => {
      state.isLoginModalOpen = true;
      state.redirectAfterLogin = action.payload;
    },

    closeLoginModal: (state) => {
      state.isLoginModalOpen = false;
      state.redirectAfterLogin = null;
    },

    openRegistrationModal: (state) => {
      state.isRegistrationModalOpen = true;
    },

    closeRegistrationModal: (state) => {
      state.isRegistrationModalOpen = false;
    },

    // Error management
    clearAuthError: (state) => {
      state.error = null;
    },

    setAuthError: (state, action: PayloadAction<AuthError>) => {
      state.error = action.payload;
      state.isLoading = false;
    },

    // Complete logout (clear all auth state)
    clearAuthState: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.accessToken = null;
      state.refreshToken = null;
      state.tokenExpiresAt = null;
      state.permissions = [];
      state.currentTenantId = null;
      state.sessionInfo = null;
      state.error = null;
      state.isLoading = false;
      state.isLoginModalOpen = false;
      state.isRegistrationModalOpen = false;
      state.redirectAfterLogin = null;
    },
  },
  extraReducers: (builder) => {
    // Login
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        const { user, accessToken, refreshToken, expiresIn } = action.payload;
        state.isLoading = false;
        state.user = user;
        state.isAuthenticated = true;
        state.accessToken = accessToken;
        state.refreshToken = refreshToken;
        state.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
        state.error = null;
        state.isLoginModalOpen = false;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as AuthError;
        state.isAuthenticated = false;
      });

    // Register
    builder
      .addCase(registerUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        const { user, accessToken, refreshToken, expiresIn } = action.payload;
        state.isLoading = false;
        state.user = user;
        state.isAuthenticated = true;
        state.accessToken = accessToken;
        state.refreshToken = refreshToken;
        state.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
        state.error = null;
        state.isRegistrationModalOpen = false;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as AuthError;
      });

    // Token refresh
    builder
      .addCase(refreshAuthToken.pending, (state) => {
        // Don't set loading for token refresh to avoid UI flicker
      })
      .addCase(refreshAuthToken.fulfilled, (state, action) => {
        const { accessToken, refreshToken, expiresIn } = action.payload;
        state.accessToken = accessToken;
        state.refreshToken = refreshToken;
        state.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
        state.error = null;
      })
      .addCase(refreshAuthToken.rejected, (state, action) => {
        // Token refresh failed, clear auth state
        state.user = null;
        state.isAuthenticated = false;
        state.accessToken = null;
        state.refreshToken = null;
        state.tokenExpiresAt = null;
        state.permissions = [];
        state.currentTenantId = null;
        state.sessionInfo = null;
        state.error = action.payload as AuthError;
      });

    // Logout
    builder
      .addCase(logoutUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        // Clear all auth state
        state.user = null;
        state.isAuthenticated = false;
        state.isLoading = false;
        state.accessToken = null;
        state.refreshToken = null;
        state.tokenExpiresAt = null;
        state.permissions = [];
        state.currentTenantId = null;
        state.sessionInfo = null;
        state.error = null;
      })
      .addCase(logoutUser.rejected, (state) => {
        // Even if logout fails, clear local state
        state.user = null;
        state.isAuthenticated = false;
        state.isLoading = false;
        state.accessToken = null;
        state.refreshToken = null;
        state.tokenExpiresAt = null;
        state.permissions = [];
        state.currentTenantId = null;
        state.sessionInfo = null;
      });

    // Get current user
    builder
      .addCase(getCurrentUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(getCurrentUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as AuthError;
        // Don't clear auth state here, might just be a network error
      });

    // Email verification
    builder
      .addCase(verifyEmail.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(verifyEmail.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
        // Update user's email verification status if user is loaded
        if (state.user) {
          state.user.emailVerified = true;
        }
      })
      .addCase(verifyEmail.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as AuthError;
      });

    // Password reset request
    builder
      .addCase(requestPasswordReset.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(requestPasswordReset.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(requestPasswordReset.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as AuthError;
      });

    // Password reset
    builder
      .addCase(resetPassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as AuthError;
      });
  },
});

export const {
  setTokens,
  clearTokens,
  setPermissions,
  addPermission,
  removePermission,
  clearPermissions,
  setCurrentTenantId,
  setSessionInfo,
  clearSessionInfo,
  openLoginModal,
  closeLoginModal,
  openRegistrationModal,
  closeRegistrationModal,
  clearAuthError,
  setAuthError,
  clearAuthState,
} = authSlice.actions;

// Selectors
export const selectAuth = (state: { auth: AuthState }) => state.auth;
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectIsLoading = (state: { auth: AuthState }) => state.auth.isLoading;
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error;
export const selectAccessToken = (state: { auth: AuthState }) => state.auth.accessToken;
export const selectRefreshToken = (state: { auth: AuthState }) => state.auth.refreshToken;
export const selectTokenExpiresAt = (state: { auth: AuthState }) => state.auth.tokenExpiresAt;
export const selectPermissions = (state: { auth: AuthState }) => state.auth.permissions;
export const selectCurrentTenantId = (state: { auth: AuthState }) => state.auth.currentTenantId;
export const selectSessionInfo = (state: { auth: AuthState }) => state.auth.sessionInfo;
export const selectIsLoginModalOpen = (state: { auth: AuthState }) => state.auth.isLoginModalOpen;
export const selectIsRegistrationModalOpen = (state: { auth: AuthState }) => state.auth.isRegistrationModalOpen;
export const selectRedirectAfterLogin = (state: { auth: AuthState }) => state.auth.redirectAfterLogin;

// Computed selectors
export const selectIsTokenExpired = (state: { auth: AuthState }) => {
  const { tokenExpiresAt } = state.auth;
  if (!tokenExpiresAt) return true;
  return new Date() >= new Date(tokenExpiresAt);
};

export const selectHasPermission = (permission: string) => (state: { auth: AuthState }) => {
  return state.auth.permissions.includes(permission);
};

export const selectHasAnyPermission = (permissions: string[]) => (state: { auth: AuthState }) => {
  return permissions.some(permission => state.auth.permissions.includes(permission));
};

export const selectHasAllPermissions = (permissions: string[]) => (state: { auth: AuthState }) => {
  return permissions.every(permission => state.auth.permissions.includes(permission));
};

export const selectUserRole = (state: { auth: AuthState }) => state.auth.user?.role;

export const selectUserFullName = (state: { auth: AuthState }) => {
  const user = state.auth.user;
  if (!user) return null;
  return `${user.firstName} ${user.lastName}`.trim();
};

export const selectIsEmailVerified = (state: { auth: AuthState }) => state.auth.user?.emailVerified ?? false;

export default authSlice.reducer;