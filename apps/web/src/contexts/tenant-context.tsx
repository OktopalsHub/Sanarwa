'use client';

import { tenantApi } from '@/lib/api/tenant';
import {
  CreateTenantRequest,
  InviteMemberRequest,
  Tenant,
  TenantMember,
  TenantState,
  UpdateTenantMemberRequest,
  UpdateTenantRequest,
} from '@/lib/types/tenant';
import React, { createContext, useCallback, useContext, useEffect, useReducer } from 'react';
import { useAuth } from './auth-context';

interface TenantContextType extends TenantState {
  selectedTenant: Tenant | null;
  switchTenant: (tenantId: string) => Promise<void>;
  createTenant: (data: CreateTenantRequest) => Promise<Tenant>;
  updateTenant: (tenantId: string, data: UpdateTenantRequest) => Promise<void>;
  deleteTenant: (tenantId: string) => Promise<void>;
  inviteMember: (data: InviteMemberRequest) => Promise<void>;
  updateMember: (memberId: string, data: UpdateTenantMemberRequest) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  refreshTenants: () => Promise<void>;
  clearError: () => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

type TenantAction =
  | { type: 'TENANT_LOADING' }
  | { type: 'TENANTS_LOADED'; payload: { tenants: Tenant[]; memberships: TenantMember[] } }
  | { type: 'CURRENT_TENANT_SET'; payload: Tenant }
  | { type: 'TENANT_CREATED'; payload: Tenant }
  | { type: 'TENANT_UPDATED'; payload: Tenant }
  | { type: 'TENANT_DELETED'; payload: string }
  | { type: 'MEMBER_INVITED'; payload: TenantMember }
  | { type: 'MEMBER_UPDATED'; payload: TenantMember }
  | { type: 'MEMBER_REMOVED'; payload: string }
  | { type: 'TENANT_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' };

const initialState: TenantState = {
  currentTenant: null,
  tenants: [],
  memberships: [],
  invitations: [],
  isLoading: false,
  error: null,
};

function tenantReducer(state: TenantState, action: TenantAction): TenantState {
  switch (action.type) {
    case 'TENANT_LOADING':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'TENANTS_LOADED':
      return {
        ...state,
        tenants: action.payload.tenants,
        memberships: action.payload.memberships,
        isLoading: false,
        error: null,
      };
    case 'CURRENT_TENANT_SET':
      return {
        ...state,
        currentTenant: action.payload,
        isLoading: false,
        error: null,
      };
    case 'TENANT_CREATED':
      return {
        ...state,
        tenants: [...state.tenants, action.payload],
        isLoading: false,
        error: null,
      };
    case 'TENANT_UPDATED':
      return {
        ...state,
        tenants: state.tenants.map(tenant =>
          tenant.id === action.payload.id ? action.payload : tenant
        ),
        currentTenant: state.currentTenant?.id === action.payload.id
          ? action.payload
          : state.currentTenant,
        isLoading: false,
        error: null,
      };
    case 'TENANT_DELETED':
      return {
        ...state,
        tenants: state.tenants.filter(tenant => tenant.id !== action.payload),
        currentTenant: state.currentTenant?.id === action.payload
          ? null
          : state.currentTenant,
        isLoading: false,
        error: null,
      };
    case 'TENANT_ERROR':
      return {
        ...state,
        isLoading: false,
        error: action.payload,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
}

interface TenantProviderProps {
  children: React.ReactNode;
}

export function TenantProvider({ children }: TenantProviderProps) {
  const [state, dispatch] = useReducer(tenantReducer, initialState);
  const { isAuthenticated } = useAuth();

  const refreshTenants = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      dispatch({ type: 'TENANT_LOADING' });

      const [tenants, currentTenant] = await Promise.all([
        tenantApi.getTenants(),
        tenantApi.getCurrentTenant(),
      ]);

      // Get memberships for all tenants
      const memberships: TenantMember[] = [];
      for (const tenant of tenants) {
        try {
          const tenantMembers = await tenantApi.getTenantMembers(tenant.id);
          memberships.push(...tenantMembers);
        } catch (error) {
          console.error(`Failed to load members for tenant ${tenant.id}:`, error);
        }
      }

      dispatch({
        type: 'TENANTS_LOADED',
        payload: { tenants, memberships }
      });

      if (currentTenant) {
        dispatch({ type: 'CURRENT_TENANT_SET', payload: currentTenant });
      }
    } catch (error) {
      dispatch({
        type: 'TENANT_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to load tenants'
      });
    }
  }, [isAuthenticated]);

  const switchTenant = useCallback(async (tenantId: string) => {
    try {
      dispatch({ type: 'TENANT_LOADING' });

      await tenantApi.setCurrentTenant(tenantId);
      const tenant = await tenantApi.getTenant(tenantId);

      dispatch({ type: 'CURRENT_TENANT_SET', payload: tenant });

      // Log tenant switch (fire and forget)
      try {
        const { auditLogger } = await import('@/lib/services/audit-logger');
        auditLogger.logTenantSwitch(tenantId);
      } catch (auditError) {
        console.error('Failed to log tenant switch audit entry:', auditError);
      }
    } catch (error) {
      dispatch({
        type: 'TENANT_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to switch tenant'
      });
      throw error;
    }
  }, []);

  const createTenant = useCallback(async (data: CreateTenantRequest) => {
    try {
      dispatch({ type: 'TENANT_LOADING' });

      const tenant = await tenantApi.createTenant(data);
      dispatch({ type: 'TENANT_CREATED', payload: tenant });

      return tenant;
    } catch (error) {
      dispatch({
        type: 'TENANT_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to create tenant'
      });
      throw error;
    }
  }, []);

  const updateTenant = useCallback(async (tenantId: string, data: UpdateTenantRequest) => {
    try {
      dispatch({ type: 'TENANT_LOADING' });

      const tenant = await tenantApi.updateTenant(tenantId, data);
      dispatch({ type: 'TENANT_UPDATED', payload: tenant });
    } catch (error) {
      dispatch({
        type: 'TENANT_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to update tenant'
      });
      throw error;
    }
  }, []);

  const deleteTenant = useCallback(async (tenantId: string) => {
    try {
      dispatch({ type: 'TENANT_LOADING' });

      await tenantApi.deleteTenant(tenantId);
      dispatch({ type: 'TENANT_DELETED', payload: tenantId });
    } catch (error) {
      dispatch({
        type: 'TENANT_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to delete tenant'
      });
      throw error;
    }
  }, []);

  const inviteMember = useCallback(async (data: InviteMemberRequest) => {
    if (!state.currentTenant) {
      throw new Error('No current tenant selected');
    }

    try {
      await tenantApi.inviteMember(state.currentTenant.id, data);
      // Refresh tenant data to get updated member list
      await refreshTenants();
    } catch (error) {
      dispatch({
        type: 'TENANT_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to invite member'
      });
      throw error;
    }
  }, [state.currentTenant, refreshTenants]);

  const updateMember = useCallback(async (memberId: string, data: UpdateTenantMemberRequest) => {
    if (!state.currentTenant) {
      throw new Error('No current tenant selected');
    }

    try {
      const member = await tenantApi.updateTenantMember(memberId, data);
      dispatch({ type: 'MEMBER_UPDATED', payload: member });
    } catch (error) {
      dispatch({
        type: 'TENANT_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to update member'
      });
      throw error;
    }
  }, [state.currentTenant]);

  const removeMember = useCallback(async (memberId: string) => {
    if (!state.currentTenant) {
      throw new Error('No current tenant selected');
    }

    try {
      await tenantApi.removeTenantMember(memberId);
      dispatch({ type: 'MEMBER_REMOVED', payload: memberId });
    } catch (error) {
      dispatch({
        type: 'TENANT_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to remove member'
      });
      throw error;
    }
  }, [state.currentTenant]);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  // Load tenants when user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      refreshTenants();
    }
  }, [isAuthenticated, refreshTenants]);

  const value: TenantContextType = {
    ...state,
    selectedTenant: state.currentTenant,
    switchTenant,
    createTenant,
    updateTenant,
    deleteTenant,
    inviteMember,
    updateMember,
    removeMember,
    refreshTenants,
    clearError,
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}