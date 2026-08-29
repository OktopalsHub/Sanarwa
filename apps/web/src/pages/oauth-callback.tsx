"use client";

import { redirectAfterAuth } from "@/lib/auth/post-auth-redirect";
import { authApi } from "@/lib/api/auth";
import { toastApiError } from "@/lib/utils/api-error-message";
import { useRouter, useSearchParams } from "@/compat/next-navigation";
import { useEffect, useState } from "react";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        const accessToken =
          searchParams.get("accessToken") || searchParams.get("access_token");
        const refreshToken =
          searchParams.get("refreshToken") || searchParams.get("refresh_token");
        const errorParam = searchParams.get("error");

        if (errorParam) {
          setError(decodeURIComponent(errorParam));
          setTimeout(() => router.push("/login"), 3000);
          return;
        }

        if (!accessToken) {
          setError("Invalid OAuth callback — missing access token");
          setTimeout(() => router.push("/login"), 3000);
          return;
        }

        authApi.setAuthToken(accessToken);
        if (refreshToken) {
          authApi.setRefreshToken(refreshToken);
        }

        await redirectAfterAuth(router);
      } catch (err) {
        toastApiError(err, "OAuth sign-in failed");
        setError("Failed to process OAuth callback");
        setTimeout(() => router.push("/login"), 3000);
      }
    };

    void handleOAuthCallback();
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)] px-4">
        <div className="space-y-4 text-center">
          <div className="text-lg font-medium text-[var(--color-danger)]">Authentication error</div>
          <p className="text-[var(--color-muted)]">{error}</p>
          <p className="text-sm text-[var(--color-muted)]">Redirecting to sign in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)] px-4">
      <div className="space-y-4 text-center">
        <div className="mx-auto size-8 animate-spin rounded-full border-2 border-[var(--color-rule)] border-t-[var(--hm-accent)]" />
        <p className="text-[var(--color-muted)]">Completing sign in…</p>
      </div>
    </div>
  );
}
