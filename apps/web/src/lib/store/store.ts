import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { persistReducer, persistStore } from "redux-persist";
import storage from "redux-persist/lib/storage";

const createNoopStorage = () => ({
  getItem: (_key: string) => Promise.resolve(null),
  setItem: (_key: string, value: unknown) => Promise.resolve(value),
  removeItem: (_key: string) => Promise.resolve(),
});
import { authSlice } from "./slices/auth-slice";
import { tenantSlice } from "./slices/tenant-slice";
import { uiSlice } from "./slices/ui-slice";
import { userSlice } from "./slices/user-slice";
import { workflowSlice } from "./slices/workflow-slice";

// Create storage with fallback for SSR
const createStorage = () => {
  if (typeof window === "undefined") {
    return createNoopStorage();
  }
  return storage;
};

// Persist configuration
const persistConfig = {
  key: "sanarwa-root",
  storage: createStorage(),
  whitelist: ["auth", "user", "tenant", "ui"], // Only persist these slices
  // workflow slice is not persisted (too large and real-time)
};

// Auth persist config - persist tokens and user data
const authPersistConfig = {
  key: "auth",
  storage: createStorage(),
  whitelist: [
    "user",
    "accessToken",
    "refreshToken",
    "tokenExpiresAt",
    "permissions",
    "currentTenantId",
  ], // Persist auth data
  blacklist: [
    "isLoading",
    "error",
    "isLoginModalOpen",
    "isRegistrationModalOpen",
    "redirectAfterLogin",
  ], // Don't persist UI state
};

// User persist config - persist user preferences and settings
const userPersistConfig = {
  key: "user",
  storage: createStorage(),
  whitelist: ["preferences", "recentTenants"], // Only persist specific user data
};

// Tenant persist config - persist current tenant and recent tenants
const tenantPersistConfig = {
  key: "tenant",
  storage: createStorage(),
  whitelist: ["currentTenantId", "recentTenants"], // Only persist tenant selection
};

// UI persist config - persist theme and layout preferences
const uiPersistConfig = {
  key: "ui",
  storage: createStorage(),
  whitelist: ["theme", "sidebarCollapsed", "dashboardLayout"], // Persist UI preferences
};

// Create root reducer with persistence
const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authSlice.reducer),
  user: persistReducer(userPersistConfig, userSlice.reducer),
  tenant: persistReducer(tenantPersistConfig, tenantSlice.reducer),
  ui: persistReducer(uiPersistConfig, uiSlice.reducer),
  workflow: workflowSlice.reducer, // Not persisted
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

// Import middleware
import {
  apiSyncMiddleware,
  errorHandlingMiddleware,
  optimisticUpdateMiddleware,
} from "./middleware/api-sync-middleware";

// Configure store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore redux-persist actions
        ignoredActions: [
          "persist/PERSIST",
          "persist/REHYDRATE",
          "persist/PAUSE",
          "persist/PURGE",
          "persist/REGISTER",
        ],
        // Ignore redux-persist state paths
        ignoredPaths: ["register", "_persist"],
      },
    }).concat(errorHandlingMiddleware, apiSyncMiddleware, optimisticUpdateMiddleware),
  devTools: process.env.NODE_ENV !== "production",
});

// Create persistor
export const persistor = persistStore(store);

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
