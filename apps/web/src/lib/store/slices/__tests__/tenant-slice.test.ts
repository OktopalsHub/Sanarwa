import { tenantApi } from "@/lib/api/tenant";
import type { Tenant, TenantMember, TenantMemberRole, TenantStatus } from "@/lib/types/tenant";
import { configureStore } from "@reduxjs/toolkit";
import {
  fetchTenantMembers,
  fetchUserTenants,
  switchTenant,
  tenantSlice,
  TenantState,
} from "../tenant-slice";

// Mock the tenant API
jest.mock("@/lib/api/tenant");
const mockedTenantApi = tenantApi as jest.Mocked<typeof tenantApi>;

// Test data
const mockTenant: Tenant = {
  id: "tenant-1",
  name: "Test Tenant",
  description: "A test tenant",
  status: "active" as TenantStatus,
  quotas: {
    notifications: { daily: 1000, monthly: 30000 },
    channels: {},
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTenantMember: TenantMember = {
  id: "member-1",
  role: "admin" as TenantMemberRole,
  status: "active" as any,
  createdAt: new Date(),
  updatedAt: new Date(),
  userId: "user-1",
  tenantId: "tenant-1",
};

// Helper function to create store
const createTestStore = (initialState?: Partial<TenantState>) => {
  return configureStore({
    reducer: {
      tenant: tenantSlice.reducer,
    },
    preloadedState: {
      tenant: {
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
        ...initialState,
      },
    },
  });
};

describe("tenantSlice", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("initial state", () => {
    it("should have correct initial state", () => {
      const store = createTestStore();
      const state = store.getState().tenant;

      expect(state.currentTenantId).toBeNull();
      expect(state.currentTenant).toBeNull();
      expect(state.tenants).toEqual({});
      expect(state.userTenants).toEqual([]);
      expect(state.members).toEqual({});
      expect(state.currentUserMembership).toBeNull();
      expect(state.invitations).toEqual({});
      expect(state.pendingInvitations).toEqual([]);
      expect(state.tenantSettings).toEqual({});
      expect(state.recentTenants).toEqual([]);
      expect(state.tenantSwitchHistory).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe("synchronous actions", () => {
    it("should set current tenant", () => {
      const store = createTestStore({
        tenants: { "tenant-1": mockTenant },
      });

      store.dispatch(tenantSlice.actions.setCurrentTenant("tenant-1"));
      const state = store.getState().tenant;

      expect(state.currentTenantId).toBe("tenant-1");
      expect(state.currentTenant).toEqual(mockTenant);
      expect(state.recentTenants).toEqual(["tenant-1"]);
      expect(state.tenantSwitchHistory).toHaveLength(1);
      expect(state.tenantSwitchHistory[0]?.tenantId).toBe("tenant-1");
    });

    it("should set tenants", () => {
      const store = createTestStore();
      const tenants = [mockTenant];

      store.dispatch(tenantSlice.actions.setTenants(tenants));
      const state = store.getState().tenant;

      expect(state.tenants).toEqual({ "tenant-1": mockTenant });
      expect(state.userTenants).toEqual(["tenant-1"]);
    });

    it("should add tenant", () => {
      const store = createTestStore();

      store.dispatch(tenantSlice.actions.addTenant(mockTenant));
      const state = store.getState().tenant;

      expect(state.tenants["tenant-1"]).toEqual(mockTenant);
      expect(state.userTenants).toContain("tenant-1");
    });

    it("should update tenant", () => {
      const store = createTestStore({
        tenants: { "tenant-1": mockTenant },
        currentTenantId: "tenant-1",
        currentTenant: mockTenant,
      });

      const updates = { name: "Updated Tenant Name" };
      store.dispatch(tenantSlice.actions.updateTenant({ id: "tenant-1", updates }));
      const state = store.getState().tenant;

      expect(state.tenants["tenant-1"]?.name).toBe("Updated Tenant Name");
      expect(state.currentTenant?.name).toBe("Updated Tenant Name");
    });

    it("should remove tenant", () => {
      const store = createTestStore({
        tenants: { "tenant-1": mockTenant },
        userTenants: ["tenant-1"],
        currentTenantId: "tenant-1",
        currentTenant: mockTenant,
        recentTenants: ["tenant-1"],
      });

      store.dispatch(tenantSlice.actions.removeTenant("tenant-1"));
      const state = store.getState().tenant;

      expect(state.tenants["tenant-1"]).toBeUndefined();
      expect(state.userTenants).not.toContain("tenant-1");
      expect(state.currentTenantId).toBeNull();
      expect(state.currentTenant).toBeNull();
      expect(state.recentTenants).not.toContain("tenant-1");
    });

    it("should set tenant members", () => {
      const store = createTestStore();
      const members = [mockTenantMember];

      store.dispatch(tenantSlice.actions.setTenantMembers({ tenantId: "tenant-1", members }));
      const state = store.getState().tenant;

      expect(state.members["tenant-1"]).toEqual(members);
    });

    it("should set current user membership", () => {
      const store = createTestStore();

      store.dispatch(tenantSlice.actions.setCurrentUserMembership(mockTenantMember));
      const state = store.getState().tenant;

      expect(state.currentUserMembership).toEqual(mockTenantMember);
    });

    it("should set pending invitations", () => {
      const store = createTestStore();
      const invitations = [
        {
          id: "inv-1",
          email: "test@example.com",
          token: "token-123",
          status: "pending" as any,
          role: "member" as TenantMemberRole,
          expiresAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      store.dispatch(tenantSlice.actions.setPendingInvitations(invitations));
      const state = store.getState().tenant;

      expect(state.pendingInvitations).toEqual(invitations);
    });

    it("should clear tenant data", () => {
      const store = createTestStore({
        currentTenantId: "tenant-1",
        currentTenant: mockTenant,
        tenants: { "tenant-1": mockTenant },
        userTenants: ["tenant-1"],
        currentUserMembership: mockTenantMember,
      });

      store.dispatch(tenantSlice.actions.clearTenantData());
      const state = store.getState().tenant;

      expect(state.currentTenantId).toBeNull();
      expect(state.currentTenant).toBeNull();
      expect(state.tenants).toEqual({});
      expect(state.userTenants).toEqual([]);
      expect(state.currentUserMembership).toBeNull();
      // Recent tenants should be preserved
      expect(state.recentTenants).toBeDefined();
    });

    it("should clear all errors", () => {
      const store = createTestStore({
        error: "Some error",
        memberError: "Member error",
        invitationError: "Invitation error",
        settingsError: "Settings error",
      });

      store.dispatch(tenantSlice.actions.clearAllErrors());
      const state = store.getState().tenant;

      expect(state.error).toBeNull();
      expect(state.memberError).toBeNull();
      expect(state.invitationError).toBeNull();
      expect(state.settingsError).toBeNull();
    });
  });

  describe("async actions", () => {
    describe("fetchUserTenants", () => {
      it("should handle successful fetch", async () => {
        mockedTenantApi.getTenants.mockResolvedValue([mockTenant]);
        const store = createTestStore();

        await store.dispatch(fetchUserTenants());
        const state = store.getState().tenant;

        expect(state.isLoading).toBe(false);
        expect(state.tenants).toEqual({ "tenant-1": mockTenant });
        expect(state.userTenants).toEqual(["tenant-1"]);
        expect(state.error).toBeNull();
      });

      it("should handle fetch failure", async () => {
        const error = new Error("Failed to fetch tenants");
        mockedTenantApi.getTenants.mockRejectedValue(error);
        const store = createTestStore();

        await store.dispatch(fetchUserTenants());
        const state = store.getState().tenant;

        expect(state.isLoading).toBe(false);
        expect(state.error).toBe("Failed to fetch tenants");
        expect(state.tenants).toEqual({});
      });

      it("should set loading state during fetch", () => {
        mockedTenantApi.getTenants.mockImplementation(() => new Promise(() => {})); // Never resolves
        const store = createTestStore();

        store.dispatch(fetchUserTenants());
        const state = store.getState().tenant;

        expect(state.isLoading).toBe(true);
        expect(state.error).toBeNull();
      });
    });

    describe("switchTenant", () => {
      it("should handle successful tenant switch", async () => {
        mockedTenantApi.getTenant.mockResolvedValue(mockTenant);
        mockedTenantApi.getCurrentUserMembership.mockResolvedValue(mockTenantMember);
        const store = createTestStore();

        await store.dispatch(switchTenant("tenant-1"));
        const state = store.getState().tenant;

        expect(state.isSwitchingTenant).toBe(false);
        expect(state.currentTenantId).toBe("tenant-1");
        expect(state.currentTenant).toEqual(mockTenant);
        expect(state.currentUserMembership).toEqual(mockTenantMember);
        expect(state.recentTenants).toContain("tenant-1");
        expect(state.tenantSwitchHistory).toHaveLength(1);
        expect(state.error).toBeNull();
      });

      it("should handle switch failure", async () => {
        const error = new Error("Failed to switch tenant");
        mockedTenantApi.getTenant.mockRejectedValue(error);
        const store = createTestStore();

        await store.dispatch(switchTenant("tenant-1"));
        const state = store.getState().tenant;

        expect(state.isSwitchingTenant).toBe(false);
        expect(state.error).toBe("Failed to switch tenant");
        expect(state.currentTenantId).toBeNull();
      });
    });

    describe("fetchTenantMembers", () => {
      it("should handle successful fetch", async () => {
        mockedTenantApi.getTenantMembers.mockResolvedValue([mockTenantMember]);
        const store = createTestStore();

        await store.dispatch(fetchTenantMembers("tenant-1"));
        const state = store.getState().tenant;

        expect(state.isLoadingMembers).toBe(false);
        expect(state.members["tenant-1"]).toEqual([mockTenantMember]);
        expect(state.memberError).toBeNull();
      });

      it("should handle fetch failure", async () => {
        const error = new Error("Failed to fetch members");
        mockedTenantApi.getTenantMembers.mockRejectedValue(error);
        const store = createTestStore();

        await store.dispatch(fetchTenantMembers("tenant-1"));
        const state = store.getState().tenant;

        expect(state.isLoadingMembers).toBe(false);
        expect(state.memberError).toBe("Failed to fetch members");
      });
    });
  });

  describe("selectors", () => {
    it("should select current tenant", () => {
      const store = createTestStore({
        currentTenant: mockTenant,
      });
      const state = store.getState();

      expect(tenantSlice.selectors?.selectCurrentTenant?.(state)).toEqual(mockTenant);
    });

    it("should select user tenants", () => {
      const store = createTestStore({
        tenants: { "tenant-1": mockTenant },
        userTenants: ["tenant-1"],
      });
      const state = store.getState();

      expect(tenantSlice.selectors?.selectUserTenants?.(state)).toEqual([mockTenant]);
    });

    it("should select can manage members", () => {
      const store = createTestStore({
        currentUserMembership: mockTenantMember, // admin role
      });
      const state = store.getState();

      expect(tenantSlice.selectors?.selectCanManageMembers?.(state)).toBe(true);
    });

    it("should select cannot manage members for viewer role", () => {
      const viewerMember = { ...mockTenantMember, role: "viewer" as TenantMemberRole };
      const store = createTestStore({
        currentUserMembership: viewerMember,
      });
      const state = store.getState();

      expect(tenantSlice.selectors?.selectCanManageMembers?.(state)).toBe(false);
    });
  });
});
