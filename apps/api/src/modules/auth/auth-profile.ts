/** Map User entity fields to GET /auth/profile response (OpenAPI UserProfile + web firstName/lastName). */
export function toAuthProfile(user: {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  const nameParts = (user.name || "").trim().split(/\s+/);
  const firstName = nameParts[0] || "User";
  const lastName = nameParts.slice(1).join(" ") || "";

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    firstName,
    lastName,
    fullName: user.name,
    avatar: user.image ?? undefined,
    emailVerified: user.emailVerified,
    status: "active" as const,
    authProvider: "local" as const,
    role: "basic" as const,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
