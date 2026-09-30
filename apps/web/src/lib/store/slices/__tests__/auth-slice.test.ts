import { authApi } from "@/lib/api/auth";
import type {
  AuthProvider,
  AuthResponse,
  LoginCredentials,
  RegisterData,
  User,
  UserRole,
  UserStatus,
} from "@/lib/types/auth";
import { configureStore } from "@reduxjs/toolkit";
import {
  authSlice,
  AuthState,
  loginUser,
  logoutUser,
  refreshAuthToken,
  registerUser,
} from "../auth-slice";

// Mock the auth API
jest.mock("@/lib/api/auth");
const mockedAuthApi = authApi as jest.Mocked<typeof authApi>;

// Test data
const mockUser: User = {
  id: "1",
  email: "test@example.com",
  firstName: "John",
  lastName: "Doe",
  role: "basic" as UserRole,
  status: "active" as UserStatus,
  authProvider: "local" as AuthProvider,
  emailVerified: true,
  loginAttempts: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  fullName: "John Doe",
  isLocked: false,
};

const mockAuthResponse: AuthResponse = {
  user: mockUser,
  accessToken: "mock-access-token",
  refreshToken: "mock-refresh-token",
  expiresIn: 3600,
  tokenType: "Bearer",
};

const mockLoginCredentials: LoginCredentials = {
  email: "test@example.com",
  password: "password123",
};

const mockRegisterData: RegisterData = {
  email: "test@example.com",
  password: "password123",
  firstName: "John",
  lastName: "Doe",
};

// Helper function to create store
const createTestStore = (initialState?: Partial<AuthState>) => {
  return configureStore({
    reducer: {
      auth: authSlice.reducer,
    },
    preloadedState: {
      auth: {
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
        ...initialState,
      },
    },
  });
};

describe("authSlice", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("initial state", () => {
    it("should have correct initial state", () => {
      const store = createTestStore();
      const state = store.getState().auth;

      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.tokenExpiresAt).toBeNull();
      expect(state.permissions).toEqual([]);
      expect(state.currentTenantId).toBeNull();
      expect(state.sessionInfo).toBeNull();
      expect(state.isLoginModalOpen).toBe(false);
      expect(state.isRegistrationModalOpen).toBe(false);
      expect(state.redirectAfterLogin).toBeNull();
    });
  });

  describe("synchronous actions", () => {
    it("should set tokens", () => {
      const store = createTestStore();
      const tokenData = {
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
        expiresIn: 3600,
      };

      store.dispatch(authSlice.actions.setTokens(tokenData));
      const state = store.getState().auth;

      expect(state.accessToken).toBe(tokenData.accessToken);
      expect(state.refreshToken).toBe(tokenData.refreshToken);
      expect(state.tokenExpiresAt).toBeInstanceOf(Date);
    });

    it("should clear tokens", () => {
      const store = createTestStore({
        accessToken: "token",
        refreshToken: "refresh",
        tokenExpiresAt: new Date(),
      });

      store.dispatch(authSlice.actions.clearTokens());
      const state = store.getState().auth;

      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.tokenExpiresAt).toBeNull();
    });

    it("should set permissions", () => {
      const store = createTestStore();
      const permissions = ["read:users", "write:users"];

      store.dispatch(authSlice.actions.setPermissions(permissions));
      const state = store.getState().auth;

      expect(state.permissions).toEqual(permissions);
    });

    it("should add permission", () => {
      const store = createTestStore({
        permissions: ["read:users"],
      });

      store.dispatch(authSlice.actions.addPermission("write:users"));
      const state = store.getState().auth;

      expect(state.permissions).toEqual(["read:users", "write:users"]);
    });

    it("should not add duplicate permission", () => {
      const store = createTestStore({
        permissions: ["read:users"],
      });

      store.dispatch(authSlice.actions.addPermission("read:users"));
      const state = store.getState().auth;

      expect(state.permissions).toEqual(["read:users"]);
    });

    it("should remove permission", () => {
      const store = createTestStore({
        permissions: ["read:users", "write:users"],
      });

      store.dispatch(authSlice.actions.removePermission("write:users"));
      const state = store.getState().auth;

      expect(state.permissions).toEqual(["read:users"]);
    });

    it("should clear permissions", () => {
      const store = createTestStore({
        permissions: ["read:users", "write:users"],
      });

      store.dispatch(authSlice.actions.clearPermissions());
      const state = store.getState().auth;

      expect(state.permissions).toEqual([]);
    });

    it("should set current tenant ID", () => {
      const store = createTestStore();
      const tenantId = "tenant-123";

      store.dispatch(authSlice.actions.setCurrentTenantId(tenantId));
      const state = store.getState().auth;

      expect(state.currentTenantId).toBe(tenantId);
    });

    it("should open login modal", () => {
      const store = createTestStore();
      const redirectUrl = "/dashboard";

      store.dispatch(authSlice.actions.openLoginModal(redirectUrl));
      const state = store.getState().auth;

      expect(state.isLoginModalOpen).toBe(true);
      expect(state.redirectAfterLogin).toBe(redirectUrl);
    });

    it("should close login modal", () => {
      const store = createTestStore({
        isLoginModalOpen: true,
        redirectAfterLogin: "/dashboard",
      });

      store.dispatch(authSlice.actions.closeLoginModal());
      const state = store.getState().auth;

      expect(state.isLoginModalOpen).toBe(false);
      expect(state.redirectAfterLogin).toBeNull();
    });

    it("should clear auth state", () => {
      const store = createTestStore({
        user: mockUser,
        isAuthenticated: true,
        accessToken: "token",
        refreshToken: "refresh",
        permissions: ["read:users"],
        currentTenantId: "tenant-123",
      });

      store.dispatch(authSlice.actions.clearAuthState());
      const state = store.getState().auth;

      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.permissions).toEqual([]);
      expect(state.currentTenantId).toBeNull();
    });
  });

  describe("async actions", () => {
    describe("loginUser", () => {
      it("should handle successful login", async () => {
        mockedAuthApi.login.mockResolvedValue(mockAuthResponse);
        const store = createTestStore();

        await store.dispatch(loginUser(mockLoginCredentials));
        const state = store.getState().auth;

        expect(state.isLoading).toBe(false);
        expect(state.user).toEqual(mockUser);
        expect(state.isAuthenticated).toBe(true);
        expect(state.accessToken).toBe(mockAuthResponse.accessToken);
        expect(state.refreshToken).toBe(mockAuthResponse.refreshToken);
        expect(state.error).toBeNull();
        expect(state.isLoginModalOpen).toBe(false);
      });

      it("should handle login failure", async () => {
        const error = new Error("Invalid credentials");
        mockedAuthApi.login.mockRejectedValue(error);
        const store = createTestStore();

        await store.dispatch(loginUser(mockLoginCredentials));
        const state = store.getState().auth;

        expect(state.isLoading).toBe(false);
        expect(state.user).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.error).toBeTruthy();
        expect(state.error?.message).toBe("Invalid credentials");
      });

      it("should set loading state during login", () => {
        mockedAuthApi.login.mockImplementation(() => new Promise(() => {})); // Never resolves
        const store = createTestStore();

        store.dispatch(loginUser(mockLoginCredentials));
        const state = store.getState().auth;

        expect(state.isLoading).toBe(true);
        expect(state.error).toBeNull();
      });
    });

    describe("registerUser", () => {
      it("should handle successful registration", async () => {
        mockedAuthApi.register.mockResolvedValue(mockAuthResponse);
        const store = createTestStore();

        await store.dispatch(registerUser(mockRegisterData));
        const state = store.getState().auth;

        expect(state.isLoading).toBe(false);
        expect(state.user).toEqual(mockUser);
        expect(state.isAuthenticated).toBe(true);
        expect(state.accessToken).toBe(mockAuthResponse.accessToken);
        expect(state.error).toBeNull();
        expect(state.isRegistrationModalOpen).toBe(false);
      });

      it("should handle registration failure", async () => {
        const error = new Error("Email already exists");
        mockedAuthApi.register.mockRejectedValue(error);
        const store = createTestStore();

        await store.dispatch(registerUser(mockRegisterData));
        const state = store.getState().auth;

        expect(state.isLoading).toBe(false);
        expect(state.user).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.error).toBeTruthy();
        expect(state.error?.message).toBe("Email already exists");
      });
    });

    describe("logoutUser", () => {
      it("should handle successful logout", async () => {
        mockedAuthApi.logout.mockResolvedValue();
        const store = createTestStore({
          user: mockUser,
          isAuthenticated: true,
          accessToken: "token",
          refreshToken: "refresh",
        });

        await store.dispatch(logoutUser());
        const state = store.getState().auth;

        expect(state.user).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.accessToken).toBeNull();
        expect(state.refreshToken).toBeNull();
        expect(state.isLoading).toBe(false);
      });

      it("should clear state even if logout API fails", async () => {
        mockedAuthApi.logout.mockRejectedValue(new Error("Network error"));
        const store = createTestStore({
          user: mockUser,
          isAuthenticated: true,
          accessToken: "token",
        });

        await store.dispatch(logoutUser());
        const state = store.getState().auth;

        expect(state.user).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.accessToken).toBeNull();
      });
    });

    describe("refreshAuthToken", () => {
      it("should handle successful token refresh", async () => {
        const tokenResponse = {
          accessToken: "new-access-token",
          refreshToken: "new-refresh-token",
          expiresIn: 3600,
          tokenType: "Bearer",
        };
        mockedAuthApi.refreshToken.mockResolvedValue(tokenResponse);

        const store = createTestStore({
          refreshToken: "old-refresh-token",
        });

        await store.dispatch(refreshAuthToken());
        const state = store.getState().auth;

        expect(state.accessToken).toBe(tokenResponse.accessToken);
        expect(state.refreshToken).toBe(tokenResponse.refreshToken);
        expect(state.error).toBeNull();
      });

      it("should clear auth state on token refresh failure", async () => {
        mockedAuthApi.refreshToken.mockRejectedValue(new Error("Invalid refresh token"));
        const store = createTestStore({
          user: mockUser,
          isAuthenticated: true,
          accessToken: "token",
          refreshToken: "refresh",
        });

        await store.dispatch(refreshAuthToken());
        const state = store.getState().auth;

        expect(state.user).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.accessToken).toBeNull();
        expect(state.refreshToken).toBeNull();
        expect(state.error).toBeTruthy();
      });
    });
  });

  describe("selectors", () => {
    it("should select user", () => {
      const store = createTestStore({ user: mockUser });
      const state = store.getState();

      expect(authSlice.selectors?.selectUser?.(state)).toEqual(mockUser);
    });

    it("should select authentication status", () => {
      const store = createTestStore({ isAuthenticated: true });
      const state = store.getState();

      expect(authSlice.selectors?.selectIsAuthenticated?.(state)).toBe(true);
    });

    it("should select permissions", () => {
      const permissions = ["read:users", "write:users"];
      const store = createTestStore({ permissions });
      const state = store.getState();

      expect(authSlice.selectors?.selectPermissions?.(state)).toEqual(permissions);
    });
  });
});
