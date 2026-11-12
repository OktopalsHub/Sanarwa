import "dotenv/config";
import * as argon2 from "argon2";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { toNodeHandler } from "better-auth/node";
import { organization } from "better-auth/plugins";
import { apiKey } from "@better-auth/api-key";
import { randomUUID } from "node:crypto";
import { typeormAdapter } from "@hedystia/better-auth-typeorm";
import { DataSource } from "typeorm";
import { ac, roles } from "./access";

const betterAuthDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
});

const trustedOrigins = [
  process.env.CORS_ORIGIN,
  process.env.FRONTEND_URL,
  process.env.TRUSTED_ORIGINS,
]
  .flatMap((value) => (value ? value.split(",") : []))
  .map((origin) => origin.trim())
  .filter(Boolean);

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

async function ensureInitialized() {
  if (!betterAuthDataSource.isInitialized) {
    await betterAuthDataSource.initialize();
  }
  return betterAuthDataSource;
}

async function writeAudit(input: {
  tenantId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  description: string;
  success?: boolean;
  metadata?: Record<string, unknown>;
}) {
  try {
    if (!input.tenantId) return;
    const ds = await ensureInitialized();
    await ds.query(
      `INSERT INTO audit_logs (id, tenant_id, action, resource_type, resource_id, description, success, metadata, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, now())`,
      [
        randomUUID(),
        input.tenantId,
        input.action,
        input.resourceType,
        input.resourceId,
        input.description,
        input.success ?? true,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
  } catch {}
}

async function mirrorTenantCreate(org: { id: string; name: string; slug: string }, userId: string) {
  const ds = await ensureInitialized();
  const existing = await ds.query(`SELECT id FROM tenants WHERE id = $1`, [org.id]);
  if (existing.length) return;
  const inviteCode = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  const quotas = JSON.stringify({
    notifications: { total: -1 },
    channels: {
      email: { total: 1000 },
      sms: { total: 10 },
      push: { total: 1000 },
      whatsapp: { total: 10 },
      inApp: { total: 1000 },
    },
    projects: { total: 10 },
  });
  await ds.query(
    `INSERT INTO tenants (id, name, subdomain, invite_code, status, quotas, owner_id, created_at, updated_at) VALUES ($1, $2, $3, $4, 'active', $5::json, $6, now(), now()) ON CONFLICT (id) DO NOTHING`,
    [org.id, org.name, org.slug, inviteCode, quotas, userId],
  );
  await ds.query(
    `INSERT INTO tenant_members (id, role, status, tenant_id, user_id, created_at, updated_at) VALUES ($1, 'owner', 'active', $2, $3, now(), now()) ON CONFLICT (tenant_id, user_id) DO NOTHING`,
    [randomUUID(), org.id, userId],
  );
}

async function mirrorMemberUpsert(member: {
  organizationId: string;
  userId: string;
  role: string;
  name?: string | null;
  avatar?: string | null;
}) {
  const ds = await ensureInitialized();
  const tenantRole =
    member.role === "owner"
      ? "owner"
      : member.role === "admin"
        ? "admin"
        : member.role === "viewer"
          ? "viewer"
          : "member";
  const existing = await ds.query(
    `SELECT id FROM tenant_members WHERE tenant_id = $1 AND user_id = $2`,
    [member.organizationId, member.userId],
  );
  if (existing.length) {
    await ds.query(
      `UPDATE tenant_members SET role = $1, status = 'active', name = COALESCE($2, name), avatar = COALESCE($3, avatar), updated_at = now() WHERE id = $4`,
      [tenantRole, member.name ?? null, member.avatar ?? null, existing[0].id],
    );
    return;
  }
  await ds.query(
    `INSERT INTO tenant_members (id, role, status, tenant_id, user_id, name, avatar, created_at, updated_at) VALUES ($1, $2, 'active', $3, $4, $5, $6, now(), now()) ON CONFLICT (tenant_id, user_id) DO NOTHING`,
    [
      randomUUID(),
      tenantRole,
      member.organizationId,
      member.userId,
      member.name ?? null,
      member.avatar ?? null,
    ],
  );
}

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET ?? process.env.JWT_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  basePath: "/api/v1/auth",
  appName: "Sanarwa",
  database: typeormAdapter(betterAuthDataSource),
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await writeAudit({
            tenantId: null,
            action: "CREATE",
            resourceType: "USER",
            resourceId: user.id,
            description: `User created ${user.email}`,
            metadata: { email: user.email },
          });
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          await writeAudit({
            tenantId: (session as { activeOrganizationId?: string }).activeOrganizationId ?? null,
            action: "LOGIN",
            resourceType: "USER",
            resourceId: session.userId,
            description: "User logged in",
            metadata: { sessionId: session.id },
          });
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    password: {
      hash: (password: string) => argon2.hash(password),
      verify: ({ password, hash }: { password: string; hash: string }) =>
        argon2.verify(hash, password),
    },
    sendResetPassword: async ({ user, url }) => {
      const parsed = new URL(url);
      const token = parsed.pathname.split("/").pop() ?? "";
      const frontend = process.env.FRONTEND_URL ?? "http://localhost:3001";
      const resetUrl = `${frontend}/reset-password?token=${token}`;
      console.log(`[auth] password reset for ${user.email} -> ${resetUrl}`);
    },
  },
  socialProviders: {
    ...(googleClientId && googleClientSecret
      ? { google: { clientId: googleClientId, clientSecret: googleClientSecret } }
      : {}),
    ...(githubClientId && githubClientSecret
      ? { github: { clientId: githubClientId, clientSecret: githubClientSecret } }
      : {}),
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github"],
    },
  },
  verification: {
    fields: {
      value: "token",
    },
  },
  trustedOrigins,
  plugins: [
    organization({
      ac,
      roles,
      creatorRole: "owner",
      membershipLimit: 100,
      requireEmailVerificationOnInvitation: false,
      invitationExpiresIn: 60 * 60 * 24 * 7,
      cancelPendingInvitationsOnReInvite: true,
      sendInvitationEmail: async (data) => {
        const frontend = process.env.FRONTEND_URL ?? "http://localhost:3001";
        const inviteLink = `${frontend}/accept-invitation/${data.invitation.id}`;
        console.log(
          `[auth] invite ${data.email} to ${data.organization.name} by ${data.inviter.user.email} -> ${inviteLink}`,
        );
      },
      organizationHooks: {
        afterCreateOrganization: async ({ organization: org, user }) => {
          await mirrorTenantCreate(org, user.id);
          await writeAudit({
            tenantId: org.id,
            action: "CREATE",
            resourceType: "TENANT",
            resourceId: org.id,
            description: `Organization created ${org.name}`,
            metadata: { userId: user.id, slug: org.slug },
          });
        },
        beforeDeleteOrganization: async () => {},
        afterDeleteOrganization: async ({ organization: org }) => {
          try {
            const ds = await ensureInitialized();
            await ds.query(
              `UPDATE tenants SET deleted_at = now(), status = 'suspended' WHERE id = $1`,
              [org.id],
            );
          } catch {}
          await writeAudit({
            tenantId: org.id,
            action: "DELETE",
            resourceType: "TENANT",
            resourceId: org.id,
            description: `Organization deleted ${org.name}`,
          });
        },
        afterAddMember: async ({ member, organization: org }) => {
          await mirrorMemberUpsert(member as never);
          await writeAudit({
            tenantId: org.id,
            action: "ROLE_CHANGE",
            resourceType: "TENANT",
            resourceId: (member as { userId: string }).userId,
            description: `Member added with role ${(member as { role: string }).role}`,
          });
        },
        afterAcceptInvitation: async ({ member, organization: org }) => {
          await mirrorMemberUpsert(member as never);
          await writeAudit({
            tenantId: org.id,
            action: "ROLE_CHANGE",
            resourceType: "TENANT",
            resourceId: (member as { userId: string }).userId,
            description: "Invitation accepted",
          });
        },
        afterUpdateMemberRole: async ({ member, organization: org }) => {
          await mirrorMemberUpsert(member as never);
          await writeAudit({
            tenantId: org.id,
            action: "ROLE_CHANGE",
            resourceType: "TENANT",
            resourceId: (member as { userId: string }).userId,
            description: `Member role updated to ${(member as { role: string }).role}`,
          });
        },
        afterRemoveMember: async ({ member }) => {
          try {
            const ds = await ensureInitialized();
            await ds.query(
              `UPDATE tenant_members SET status = 'inactive', updated_at = now() WHERE tenant_id = $1 AND user_id = $2`,
              [
                (member as { organizationId: string }).organizationId,
                (member as { userId: string }).userId,
              ],
            );
          } catch {}
        },
      },
      schema: {
        member: {
          additionalFields: {
            name: {
              type: "string",
              required: false,
              input: true,
            },
            avatar: {
              type: "string",
              required: false,
              input: true,
            },
          },
        },
      },
    }),
    apiKey([
      {
        configId: "organization",
        references: "organization",
        defaultPrefix: "sa_",
        maximumNameLength: 120,
        enableMetadata: true,
        rateLimit: { enabled: false },
        keyExpiration: { minExpiresIn: 0 },
        startingCharactersConfig: { charactersLength: 16 },
      },
    ]),
  ],
});

export const betterAuthHandler = toNodeHandler(auth);
export type Auth = typeof auth;
export type { BetterAuthOptions };
