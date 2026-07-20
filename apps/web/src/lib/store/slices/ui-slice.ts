import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface NotificationState {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  timestamp: number;
}

export interface ModalState {
  id: string;
  type: string;
  props?: Record<string, any>;
  isOpen: boolean;
}

export interface UIState {
  // Theme and layout
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  dashboardLayout: 'grid' | 'list';

  // Loading states
  globalLoading: boolean;
  loadingStates: Record<string, boolean>;

  // Notifications
  notifications: NotificationState[];

  // Modals
  modals: Record<string, ModalState>;

  // Navigation
  breadcrumbs: Array<{ label: string; href?: string }>;

  // Search
  globalSearchOpen: boolean;
  globalSearchQuery: string;

  // Command palette
  commandPaletteOpen: boolean;

  // Error states
  errors: Record<string, string>;
}

const initialState: UIState = {
  theme: 'system',
  sidebarCollapsed: false,
  dashboardLayout: 'grid',
  globalLoading: false,
  loadingStates: {},
  notifications: [],
  modals: {},
  breadcrumbs: [],
  globalSearchOpen: false,
  globalSearchQuery: '',
  commandPaletteOpen: false,
  errors: {},
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // Theme actions
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.theme = action.payload;
    },

    // Sidebar actions
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },

    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
    },

    // Dashboard layout
    setDashboardLayout: (state, action: PayloadAction<'grid' | 'list'>) => {
      state.dashboardLayout = action.payload;
    },

    // Loading states
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.globalLoading = action.payload;
    },

    setLoading: (state, action: PayloadAction<{ key: string; loading: boolean }>) => {
      const { key, loading } = action.payload;
      if (loading) {
        state.loadingStates[key] = true;
      } else {
        delete state.loadingStates[key];
      }
    },

    // Notification actions
    addNotification: (state, action: PayloadAction<Omit<NotificationState, 'id' | 'timestamp'>>) => {
      const notification: NotificationState = {
        ...action.payload,
        id: Date.now().toString(),
        timestamp: Date.now(),
      };
      state.notifications.push(notification);
    },

    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
    },

    clearNotifications: (state) => {
      state.notifications = [];
    },

    // Modal actions
    openModal: (state, action: PayloadAction<{ id: string; type: string; props?: Record<string, any> }>) => {
      const { id, type, props } = action.payload;
      state.modals[id] = { id, type, props, isOpen: true };
    },

    closeModal: (state, action: PayloadAction<string>) => {
      const modalId = action.payload;
      if (state.modals[modalId]) {
        state.modals[modalId].isOpen = false;
      }
    },

    removeModal: (state, action: PayloadAction<string>) => {
      delete state.modals[action.payload];
    },

    // Breadcrumb actions
    setBreadcrumbs: (state, action: PayloadAction<Array<{ label: string; href?: string }>>) => {
      state.breadcrumbs = action.payload;
    },

    addBreadcrumb: (state, action: PayloadAction<{ label: string; href?: string }>) => {
      state.breadcrumbs.push(action.payload);
    },

    // Search actions
    setGlobalSearchOpen: (state, action: PayloadAction<boolean>) => {
      state.globalSearchOpen = action.payload;
      if (!action.payload) {
        state.globalSearchQuery = '';
      }
    },

    setGlobalSearchQuery: (state, action: PayloadAction<string>) => {
      state.globalSearchQuery = action.payload;
    },

    // Command palette actions
    setCommandPaletteOpen: (state, action: PayloadAction<boolean>) => {
      state.commandPaletteOpen = action.payload;
    },

    // Error actions
    setError: (state, action: PayloadAction<{ key: string; error: string }>) => {
      const { key, error } = action.payload;
      state.errors[key] = error;
    },

    clearError: (state, action: PayloadAction<string>) => {
      delete state.errors[action.payload];
    },

    clearAllErrors: (state) => {
      state.errors = {};
    },
  },
});

export const {
  setTheme,
  toggleSidebar,
  setSidebarCollapsed,
  setDashboardLayout,
  setGlobalLoading,
  setLoading,
  addNotification,
  removeNotification,
  clearNotifications,
  openModal,
  closeModal,
  removeModal,
  setBreadcrumbs,
  addBreadcrumb,
  setGlobalSearchOpen,
  setGlobalSearchQuery,
  setCommandPaletteOpen,
  setError,
  clearError,
  clearAllErrors,
} = uiSlice.actions;

// Selectors
export const selectTheme = (state: { ui: UIState }) => state.ui.theme;
export const selectSidebarCollapsed = (state: { ui: UIState }) => state.ui.sidebarCollapsed;
export const selectDashboardLayout = (state: { ui: UIState }) => state.ui.dashboardLayout;
export const selectGlobalLoading = (state: { ui: UIState }) => state.ui.globalLoading;
export const selectLoading = (key: string) => (state: { ui: UIState }) =>
  state.ui.loadingStates[key] || false;
export const selectNotifications = (state: { ui: UIState }) => state.ui.notifications;
export const selectModal = (id: string) => (state: { ui: UIState }) => state.ui.modals[id];
export const selectBreadcrumbs = (state: { ui: UIState }) => state.ui.breadcrumbs;
export const selectGlobalSearchOpen = (state: { ui: UIState }) => state.ui.globalSearchOpen;
export const selectGlobalSearchQuery = (state: { ui: UIState }) => state.ui.globalSearchQuery;
export const selectCommandPaletteOpen = (state: { ui: UIState }) => state.ui.commandPaletteOpen;
export const selectError = (key: string) => (state: { ui: UIState }) => state.ui.errors[key];
export const selectAllErrors = (state: { ui: UIState }) => state.ui.errors;