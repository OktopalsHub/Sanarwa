import { tenantApi } from "@/lib/api/tenant";
import type { Invitation, Tenant, TenantMember, TenantSettings } from "@/lib/types/tenant";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface TenantState {
  // Current tenant context
  currentTenantId: string | null;
  currentTenant: Tenant | null;

  // Tenant data
  tenants: Record<string, Tenant>;
  userTenants: string[];

  // Member management
  members: Record<string, TenantMember[]>;
  currentUserMembership: TenantMember | null;

  // Invitation management
  invitations: Record<string, Invitation[]>;
  pendingInvitations: Invitation[];

  // Tenant settings
  tenantSettings: Record<string, TenantSettings>;

  // Navigation
  recentTenants: string[];
  tenantSwitchHistory: Array<{ tenantId: string; timestamp: Date }>;

  // Loading states
  isLoading: boolean;
  isLoadingMembers: boolean;
  isLoadingInvitations: boolean;
  isLoadingSettings: boolean;
  isSwitchingTenant: boolean;

  // Error states
  error: string | null;
  memberError: string | null;
  invitationError: string | null;
  settingsError: string | null;
}

const initialState: TenantState = {
  currentTenantId: null,
  currentTenant: null,
  tenants: {},
  userTenants: [],
  members: {},
  currentUserMembership: null,
  invitations: {},
  pendingInvitations: [],
  tenantSettings: {},
  recentTenants: [],
  tenantSwitchHistory: [],
  isLoading: false,
  isLoadingMembers: false,
  isLoadingInvitations: false,
  isLoadingSettings: false,
  isSwitchingTenant: false,
  error: null,
  memberError: null,
  invitationError: null,
  settingsError: null,
};

// Async thunks
export const fetchUserTenants = createAsyncThunk(
  "tenant/fetchUserTenants",
  async (_, { rejectWithValue }) => {
    try {
      const tenants = await tenantApi.getTenants();
      return tenants;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch user tenants");
    }
  },
);

export const switchTenant = createAsyncThunk(
  "tenant/switchTenant",
  async (tenantId: string, { rejectWithValue }) => {
    try {
      const tenant = await tenantApi.getTenant(tenantId);
      const membership = await tenantApi.getCurrentUserMembership(tenantId);
      return { tenant, membership };
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to switch tenant");
    }
  },
);

export const fetchTenantMembers = createAsyncThunk(
  "tenant/fetchTenantMembers",
  async (tenantId: string, { rejectWithValue }) => {
    try {
      const members = await tenantApi.getTenantMembers();
      return { tenantId, members };
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch tenant members");
    }
  },
);

export const fetchPendingInvitations = createAsyncThunk(
  "tenant/fetchPendingInvitations",
  async (_, { rejectWithValue }) => {
    try {
      const invitations = await tenantApi.getTenantInvitations();
      return invitations;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch pending invitations");
    }
  },
);

export const acceptInvitation = createAsyncThunk(
  "tenant/acceptInvitation",
  async (invitationId: string, { rejectWithValue }) => {
    try {
      const result = await tenantApi.acceptInvitation({ token: invitationId });
      return { invitationId, ...result };
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to accept invitation");
    }
  },
);

export const fetchTenantSettings = createAsyncThunk(
  "tenant/fetchTenantSettings",
  async (tenantId: string, { rejectWithValue }) => {
    try {
      const settings = await tenantApi.getTenantSettings(tenantId);
      return { tenantId, settings };
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch tenant settings");
    }
  },
);

export const tenantSlice = createSlice({
  name: "tenant",
  initialState,
  selectors: {
    selectCurrentTenant: (state) => state.currentTenant,
    selectUserTenants: (state) => state.userTenants.map((id) => state.tenants[id]).filter(Boolean),
    selectCanManageMembers: (state) => {
      const membership = state.currentUserMembership;
      return membership && ["owner", "admin"].includes(membership.role);
    },
  },
  reducers: {
    // Current tenant actions
    setCurrentTenant: (state, action: PayloadAction<string | null>) => {
      const tenantId = action.payload;
      state.currentTenantId = tenantId;
      state.currentTenant = tenantId ? state.tenants[tenantId] || null : null;

      if (tenantId) {
        // Add to recent tenants
        state.recentTenants = state.recentTenants.filter((id) => id !== tenantId);
        state.recentTenants.unshift(tenantId);
        state.recentTenants = state.recentTenants.slice(0, 5);

        // Add to switch history
        state.tenantSwitchHistory.unshift({
          tenantId,
          timestamp: new Date(),
        });
        state.tenantSwitchHistory = state.tenantSwitchHistory.slice(0, 10);
      }
    },

    // Tenant data actions
    setTenants: (state, action: PayloadAction<Tenant[]>) => {
      state.tenants = {};
      state.userTenants = [];
      action.payload.forEach((tenant) => {
        state.tenants[tenant.id] = tenant;
        state.userTenants.push(tenant.id);
      });
    },

    addTenant: (state, action: PayloadAction<Tenant>) => {
      const tenant = action.payload;
      state.tenants[tenant.id] = tenant;
      if (!state.userTenants.includes(tenant.id)) {
        state.userTenants.push(tenant.id);
      }
    },

    updateTenant: (state, action: PayloadAction<{ id: string; updates: Partial<Tenant> }>) => {
      const { id, updates } = action.payload;
      if (state.tenants[id]) {
        state.tenants[id] = { ...state.tenants[id], ...updates };
        if (state.currentTenantId === id) {
          state.currentTenant = state.tenants[id];
        }
      }
    },

    removeTenant: (state, action: PayloadAction<string>) => {
      const tenantId = action.payload;
      delete state.tenants[tenantId];
      delete state.members[tenantId];
      delete state.invitations[tenantId];
      delete state.tenantSettings[tenantId];

      state.userTenants = state.userTenants.filter((id) => id !== tenantId);
      state.recentTenants = state.recentTenants.filter((id) => id !== tenantId);

      if (state.currentTenantId === tenantId) {
        state.currentTenantId = null;
        state.currentTenant = null;
        state.currentUserMembership = null;
      }
    },

    // Member management
    setTenantMembers: (
      state,
      action: PayloadAction<{ tenantId: string; members: TenantMember[] }>,
    ) => {
      const { tenantId, members } = action.payload;
      state.members[tenantId] = members;
    },

    setCurrentUserMembership: (state, action: PayloadAction<TenantMember | null>) => {
      state.currentUserMembership = action.payload;
    },

    // Invitation management
    setPendingInvitations: (state, action: PayloadAction<Invitation[]>) => {
      state.pendingInvitations = action.payload;
    },

    setTenantInvitations: (
      state,
      action: PayloadAction<{ tenantId: string; invitations: Invitation[] }>,
    ) => {
      const { tenantId, invitations } = action.payload;
      state.invitations[tenantId] = invitations;
    },

    // Tenant settings
    setTenantSettings: (
      state,
      action: PayloadAction<{ tenantId: string; settings: TenantSettings }>,
    ) => {
      const { tenantId, settings } = action.payload;
      state.tenantSettings[tenantId] = settings;
    },

    // Loading states
    setTenantLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setMembersLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoadingMembers = action.payload;
    },

    setInvitationsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoadingInvitations = action.payload;
    },

    setSettingsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoadingSettings = action.payload;
    },

    setSwitchingTenant: (state, action: PayloadAction<boolean>) => {
      state.isSwitchingTenant = action.payload;
    },

    // Error states
    setTenantError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      if (action.payload) {
        state.isLoading = false;
      }
    },

    setMemberError: (state, action: PayloadAction<string | null>) => {
      state.memberError = action.payload;
      if (action.payload) {
        state.isLoadingMembers = false;
      }
    },

    setInvitationError: (state, action: PayloadAction<string | null>) => {
      state.invitationError = action.payload;
      if (action.payload) {
        state.isLoadingInvitations = false;
      }
    },

    setSettingsError: (state, action: PayloadAction<string | null>) => {
      state.settingsError = action.payload;
      if (action.payload) {
        state.isLoadingSettings = false;
      }
    },

    // Clear all tenant data (on logout)
    clearTenantData: (state) => {
      state.currentTenantId = null;
      state.currentTenant = null;
      state.tenants = {};
      state.userTenants = [];
      state.members = {};
      state.currentUserMembership = null;
      state.invitations = {};
      state.pendingInvitations = [];
      state.tenantSettings = {};
      state.tenantSwitchHistory = [];
      state.error = null;
      state.memberError = null;
      state.invitationError = null;
      state.settingsError = null;
      state.isLoading = false;
      state.isLoadingMembers = false;
      state.isLoadingInvitations = false;
      state.isLoadingSettings = false;
      state.isSwitchingTenant = false;
      // Keep recent tenants for next login
    },

    clearAllErrors: (state) => {
      state.error = null;
      state.memberError = null;
      state.invitationError = null;
      state.settingsError = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch user tenants
    builder
      .addCase(fetchUserTenants.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchUserTenants.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tenants = {};
        state.userTenants = [];
        action.payload.forEach((tenant: any) => {
          state.tenants[tenant.id] = tenant;
          state.userTenants.push(tenant.id);
        });
        state.error = null;
      })
      .addCase(fetchUserTenants.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Switch tenant
    builder
      .addCase(switchTenant.pending, (state) => {
        state.isSwitchingTenant = true;
        state.error = null;
      })
      .addCase(switchTenant.fulfilled, (state, action) => {
        state.isSwitchingTenant = false;
        const { tenant, membership } = action.payload;

        state.tenants[tenant.id] = tenant;
        state.currentTenantId = tenant.id;
        state.currentTenant = tenant;
        state.currentUserMembership = membership;

        // Update recent tenants
        state.recentTenants = state.recentTenants.filter((id) => id !== tenant.id);
        state.recentTenants.unshift(tenant.id);
        state.recentTenants = state.recentTenants.slice(0, 5);

        // Add to switch history
        state.tenantSwitchHistory.unshift({
          tenantId: tenant.id,
          timestamp: new Date(),
        });
        state.tenantSwitchHistory = state.tenantSwitchHistory.slice(0, 10);

        state.error = null;
      })
      .addCase(switchTenant.rejected, (state, action) => {
        state.isSwitchingTenant = false;
        state.error = action.payload as string;
      });

    // Fetch tenant members
    builder
      .addCase(fetchTenantMembers.pending, (state) => {
        state.isLoadingMembers = true;
        state.memberError = null;
      })
      .addCase(fetchTenantMembers.fulfilled, (state, action) => {
        state.isLoadingMembers = false;
        const { tenantId, members } = action.payload;
        state.members[tenantId] = members;
        state.memberError = null;
      })
      .addCase(fetchTenantMembers.rejected, (state, action) => {
        state.isLoadingMembers = false;
        state.memberError = action.payload as string;
      });

    // Fetch pending invitations
    builder
      .addCase(fetchPendingInvitations.pending, (state) => {
        state.isLoadingInvitations = true;
        state.invitationError = null;
      })
      .addCase(fetchPendingInvitations.fulfilled, (state, action) => {
        state.isLoadingInvitations = false;
        state.pendingInvitations = action.payload;
        state.invitationError = null;
      })
      .addCase(fetchPendingInvitations.rejected, (state, action) => {
        state.isLoadingInvitations = false;
        state.invitationError = action.payload as string;
      });

    // Accept invitation
    builder
      .addCase(acceptInvitation.pending, (state) => {
        state.isLoadingInvitations = true;
        state.invitationError = null;
      })
      .addCase(acceptInvitation.fulfilled, (state, action) => {
        state.isLoadingInvitations = false;
        const { invitationId } = action.payload;

        // Remove from pending invitations
        state.pendingInvitations = state.pendingInvitations.filter(
          (inv) => inv.id !== invitationId,
        );

        state.invitationError = null;
      })
      .addCase(acceptInvitation.rejected, (state, action) => {
        state.isLoadingInvitations = false;
        state.invitationError = action.payload as string;
      });

    // Fetch tenant settings
    builder
      .addCase(fetchTenantSettings.pending, (state) => {
        state.isLoadingSettings = true;
        state.settingsError = null;
      })
      .addCase(fetchTenantSettings.fulfilled, (state, action) => {
        state.isLoadingSettings = false;
        const { tenantId, settings } = action.payload;
        state.tenantSettings[tenantId] = settings;
        state.settingsError = null;
      })
      .addCase(fetchTenantSettings.rejected, (state, action) => {
        state.isLoadingSettings = false;
        state.settingsError = action.payload as string;
      });
  },
});

export const {
  setCurrentTenant,
  setTenants,
  addTenant,
  updateTenant,
  removeTenant,
  setTenantMembers,
  setCurrentUserMembership,
  setPendingInvitations,
  setTenantInvitations,
  setTenantSettings,
  setTenantLoading,
  setMembersLoading,
  setInvitationsLoading,
  setSettingsLoading,
  setSwitchingTenant,
  setTenantError,
  setMemberError,
  setInvitationError,
  setSettingsError,
  clearTenantData,
  clearAllErrors,
} = tenantSlice.actions;

// Selectors
export const selectTenantState = (state: { tenant: TenantState }) => state.tenant;
export const selectCurrentTenantId = (state: { tenant: TenantState }) =>
  state.tenant.currentTenantId;
export const selectCurrentTenant = (state: { tenant: TenantState }) => state.tenant.currentTenant;
export const selectTenants = (state: { tenant: TenantState }) =>
  Object.values(state.tenant.tenants);
export const selectUserTenants = (state: { tenant: TenantState }) =>
  state.tenant.userTenants.map((id) => state.tenant.tenants[id]).filter(Boolean);
export const selectTenantById = (tenantId: string) => (state: { tenant: TenantState }) =>
  state.tenant.tenants[tenantId];
export const selectTenantMembers = (tenantId: string) => (state: { tenant: TenantState }) =>
  state.tenant.members[tenantId] || [];
export const selectCurrentUserMembership = (state: { tenant: TenantState }) =>
  state.tenant.currentUserMembership;
export const selectPendingInvitations = (state: { tenant: TenantState }) =>
  state.tenant.pendingInvitations;
export const selectTenantSettings = (tenantId: string) => (state: { tenant: TenantState }) =>
  state.tenant.tenantSettings[tenantId];
export const selectCurrentTenantSettings = (state: { tenant: TenantState }) => {
  const { currentTenantId, tenantSettings } = state.tenant;
  return currentTenantId ? tenantSettings[currentTenantId] : null;
};
export const selectRecentTenants = (state: { tenant: TenantState }) => state.tenant.recentTenants;
export const selectTenantSwitchHistory = (state: { tenant: TenantState }) =>
  state.tenant.tenantSwitchHistory;
export const selectTenantLoading = (state: { tenant: TenantState }) => state.tenant.isLoading;
export const selectMembersLoading = (state: { tenant: TenantState }) =>
  state.tenant.isLoadingMembers;
export const selectInvitationsLoading = (state: { tenant: TenantState }) =>
  state.tenant.isLoadingInvitations;
export const selectSettingsLoading = (state: { tenant: TenantState }) =>
  state.tenant.isLoadingSettings;
export const selectIsSwitchingTenant = (state: { tenant: TenantState }) =>
  state.tenant.isSwitchingTenant;
export const selectTenantError = (state: { tenant: TenantState }) => state.tenant.error;
export const selectMemberError = (state: { tenant: TenantState }) => state.tenant.memberError;
export const selectInvitationError = (state: { tenant: TenantState }) =>
  state.tenant.invitationError;
export const selectSettingsError = (state: { tenant: TenantState }) => state.tenant.settingsError;

// Computed selectors
export const selectCanManageMembers = (state: { tenant: TenantState }) => {
  const membership = state.tenant.currentUserMembership;
  return membership && ["owner", "admin"].includes(membership.role);
};

export const selectCanInviteMembers = (state: { tenant: TenantState }) => {
  const membership = state.tenant.currentUserMembership;
  const tenant = state.tenant.currentTenant;
  return (
    membership &&
    ["owner", "admin"].includes(membership.role) &&
    tenant?.settings?.allowMemberInvites !== false
  );
};

export const selectCanManageSettings = (state: { tenant: TenantState }) => {
  const membership = state.tenant.currentUserMembership;
  return membership && membership.role === "owner";
};

export default tenantSlice.reducer;
