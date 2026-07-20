import type { AuthUser } from '@/lib/types/auth';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  dashboardLayout: 'grid' | 'list';
  itemsPerPage: number;
}

export interface UserState {
  currentUser: AuthUser | null;
  preferences: UserPreferences;
  recentTenants: string[];
  isLoading: boolean;
  error: string | null;
}

const initialState: UserState = {
  currentUser: null,
  preferences: {
    theme: 'system',
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    emailNotifications: true,
    pushNotifications: true,
    dashboardLayout: 'grid',
    itemsPerPage: 10,
  },
  recentTenants: [],
  isLoading: false,
  error: null,
};

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    // User authentication actions
    setUser: (state, action: PayloadAction<AuthUser>) => {
      state.currentUser = action.payload;
      state.error = null;
    },

    clearUser: (state) => {
      state.currentUser = null;
      state.error = null;
    },

    setUserLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setUserError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },

    // User preferences actions
    updatePreferences: (state, action: PayloadAction<Partial<UserPreferences>>) => {
      state.preferences = { ...state.preferences, ...action.payload };
    },

    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.preferences.theme = action.payload;
    },

    setLanguage: (state, action: PayloadAction<string>) => {
      state.preferences.language = action.payload;
    },

    setTimezone: (state, action: PayloadAction<string>) => {
      state.preferences.timezone = action.payload;
    },

    toggleEmailNotifications: (state) => {
      state.preferences.emailNotifications = !state.preferences.emailNotifications;
    },

    togglePushNotifications: (state) => {
      state.preferences.pushNotifications = !state.preferences.pushNotifications;
    },

    setDashboardLayout: (state, action: PayloadAction<'grid' | 'list'>) => {
      state.preferences.dashboardLayout = action.payload;
    },

    setItemsPerPage: (state, action: PayloadAction<number>) => {
      state.preferences.itemsPerPage = action.payload;
    },

    // Recent tenants actions
    addRecentTenant: (state, action: PayloadAction<string>) => {
      const tenantId = action.payload;
      // Remove if already exists
      state.recentTenants = state.recentTenants.filter(id => id !== tenantId);
      // Add to beginning
      state.recentTenants.unshift(tenantId);
      // Keep only last 5
      state.recentTenants = state.recentTenants.slice(0, 5);
    },

    removeRecentTenant: (state, action: PayloadAction<string>) => {
      state.recentTenants = state.recentTenants.filter(id => id !== action.payload);
    },

    clearRecentTenants: (state) => {
      state.recentTenants = [];
    },
  },
});

export const {
  setUser,
  clearUser,
  setUserLoading,
  setUserError,
  updatePreferences,
  setTheme,
  setLanguage,
  setTimezone,
  toggleEmailNotifications,
  togglePushNotifications,
  setDashboardLayout,
  setItemsPerPage,
  addRecentTenant,
  removeRecentTenant,
  clearRecentTenants,
} = userSlice.actions;

// Selectors
export const selectCurrentUser = (state: { user: UserState }) => state.user.currentUser;
export const selectUserPreferences = (state: { user: UserState }) => state.user.preferences;
export const selectRecentTenants = (state: { user: UserState }) => state.user.recentTenants;
export const selectUserLoading = (state: { user: UserState }) => state.user.isLoading;
export const selectUserError = (state: { user: UserState }) => state.user.error;
export const selectIsAuthenticated = (state: { user: UserState }) => !!state.user.currentUser;