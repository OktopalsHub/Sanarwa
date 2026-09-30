"use client";

import { useEnsureTenantFromSlug } from "@/hooks/use-tenant-slug";
import type { ReactNode } from "react";

export function TenantSlugSync({ children }: { children: ReactNode }) {
  useEnsureTenantFromSlug();
  return <>{children}</>;
}
