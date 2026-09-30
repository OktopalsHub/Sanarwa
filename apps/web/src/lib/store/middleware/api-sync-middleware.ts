import { invalidateQueries, queryClient } from "@/lib/query/query-client";
import { Middleware } from "@reduxjs/toolkit";
import { addTenant, removeTenant, setCurrentTenant, updateTenant } from "../slices/tenant-slice";
import { addRecentTenant, clearUser, setUser, updatePreferences } from "../slices/user-slice";

// Middleware to sync Redux state changes with TanStack Query cache
export const apiSyncMiddleware: Middleware = (store) => (next) => (action) => {
  const result = next(action);

  // Sync user-related actions
  if (setUser.match(action)) {
    // Update TanStack Query cache with user data
    queryClient.setQueryData(["auth", "user"], action.payload);
  }

  if (clearUser.match(action)) {
    // Clear all cached data when user logs out
    queryClient.clear();
  }

  if (addRecentTenant.match(action)) {
    // Invalidate tenants query to refresh data
    invalidateQueries.auth();
  }

  if (updatePreferences.match(action)) {
    // Could sync preferences with server here
    // For now, just log the preference change
    console.log("User preferences updated:", action.payload);
  }

  // Sync tenant-related actions
  if (setCurrentTenant.match(action)) {
    const tenantId = action.payload;
    if (tenantId) {
      // Invalidate tenant-specific queries when switching tenants
      invalidateQueries.tenant(tenantId);
      invalidateQueries.analytics(tenantId);
    }
  }

  if (addTenant.match(action)) {
    // Invalidate tenants list
    queryClient.invalidateQueries({ queryKey: ["tenants"] });
  }

  if (updateTenant.match(action)) {
    const { id } = action.payload;
    // Update specific tenant in cache
    queryClient.setQueryData(["tenants", id], (oldData: any) => {
      if (oldData) {
        return { ...oldData, ...action.payload.updates };
      }
      return oldData;
    });
    // Invalidate related queries
    invalidateQueries.tenant(id);
  }

  if (removeTenant.match(action)) {
    const tenantId = action.payload;
    // Remove tenant from cache
    queryClient.removeQueries({ queryKey: ["tenants", tenantId] });
    queryClient.invalidateQueries({ queryKey: ["tenants"] });
  }

  return result;
};

// Middleware to handle optimistic updates
export const optimisticUpdateMiddleware: Middleware = (store) => (next) => (action) => {
  // Handle optimistic updates for better UX
  // This middleware can be extended to handle specific actions that should
  // update the UI immediately before the API call completes

  return next(action);
};

// Middleware for error handling and logging
export const errorHandlingMiddleware: Middleware = (store) => (next) => (action) => {
  try {
    return next(action);
  } catch (error) {
    console.error("Redux action error:", error);

    // Could dispatch an error action here
    // store.dispatch(setError({ key: 'redux', error: error.message }));

    throw error;
  }
};
