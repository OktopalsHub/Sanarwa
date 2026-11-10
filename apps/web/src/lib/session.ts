import { redirect } from "@tanstack/react-router";
import { authClient } from "./better-auth-client";

export async function fetchSession() {
  return authClient.getSession();
}

export async function requireSession() {
  const session = await fetchSession();
  if (!session.data?.user) {
    throw redirect({
      to: "/login",
      search: { redirect: typeof location === "undefined" ? undefined : location.pathname },
    });
  }
  return session.data.user;
}

export async function fetchOrganizations() {
  return authClient.organization.list();
}

export async function fetchActiveOrganization() {
  return authClient.organization.getOrganization();
}

export async function fetchActiveMember() {
  return authClient.organization.getActiveMember();
}
