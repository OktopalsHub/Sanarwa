"use client";

import { useTenantSlug } from "@/hooks/use-tenant-slug";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export default function ProviderDetailPage() {
  const navigate = useNavigate();
  const tenantSlug = useTenantSlug();

  useEffect(() => {
    navigate({ to: `/${tenantSlug}/providers` as never, replace: true });
  }, [navigate, tenantSlug]);

  return null;
}
