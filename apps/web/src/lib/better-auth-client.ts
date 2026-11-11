"use client";

import { createAuthClient } from "better-auth/client";
import { organizationClient } from "better-auth/client/plugins";
import { createAccessControl } from "better-auth/plugins/access";

const statement = {
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
} as const;

const ac = createAccessControl(statement);

const roles = {
  owner: ac.newRole({
    organization: ["update", "delete"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
  }),
  admin: ac.newRole({
    organization: ["update"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
  }),
  member: ac.newRole({
    organization: [],
    member: [],
    invitation: [],
  }),
  viewer: ac.newRole({
    organization: [],
    member: [],
    invitation: [],
  }),
};

const BASE_PATH = "/api/auth";

function baseURL(): string {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env;
  const api = env?.VITE_API_URL;
  if (api) return `${api.replace(/\/$/, "")}${BASE_PATH}`;
  return `http://localhost:3000${BASE_PATH}`;
}

export const authClient = createAuthClient({
  baseURL: baseURL(),
  basePath: BASE_PATH,
  plugins: [
    organizationClient({
      ac,
      roles,
      schema: {
        member: {
          additionalFields: {
            name: { type: "string" },
            avatar: { type: "string" },
          },
        },
      },
    }),
  ],
});

function useBetterAuthClient() {
  return authClient;
}

export type AuthClient = typeof authClient;
