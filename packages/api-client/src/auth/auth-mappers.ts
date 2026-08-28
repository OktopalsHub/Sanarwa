import { AuthResponse, User } from "../types/auth";

export type RawAuthPayload = {
  accessToken?: string;
  access_token?: string;
  refreshToken?: string;
  refresh_token?: string;
  user?: User & { name?: string; firstName?: string; lastName?: string };
  id?: string;
  email?: string;
  name?: string;
  tenant?: AuthResponse["tenant"];
  tenantSlug?: string;
};

function pickTokens(raw: RawAuthPayload) {
  return {
    accessToken: raw.accessToken || raw.access_token || "",
    refreshToken: raw.refreshToken || raw.refresh_token || "",
  };
}

function toAuthUser(raw: RawAuthPayload): User {
  if (raw.user) {
    const nameParts = (raw.user.name || "").split(" ");
    return {
      ...raw.user,
      firstName: raw.user.firstName || nameParts[0] || "User",
      lastName: raw.user.lastName || nameParts.slice(1).join(" ") || "Account",
    } as User;
  }

  const nameParts = (raw.name || "").split(" ");
  return {
    id: raw.id || "",
    email: raw.email || "",
    firstName: nameParts[0] || "User",
    lastName: nameParts.slice(1).join(" ") || "Account",
    name: raw.name || "",
  } as unknown as User;
}

export function toAuthResponse(raw: RawAuthPayload): AuthResponse {
  const tokens = pickTokens(raw);
  return {
    user: toAuthUser(raw),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: 3600,
    tokenType: "Bearer",
    tenant: raw.tenant,
    tenantSlug: raw.tenantSlug || raw.tenant?.subdomain || raw.tenant?.slug,
  };
}
