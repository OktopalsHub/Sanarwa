"use client";

import { useRouter, useSearchParams } from "@/compat/next-navigation";
import { useAuth } from "@/contexts/auth-context";
import { useEffect, useState } from "react";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      // better-auth client manages the OAuth flow internally.
      // The provider callback route hydrates the session automatically.
      // We wait for the session to be hydrated and then redirect.
      try {
        // Wait a moment for session hydration, then check auth state.
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (!isAuthenticated) {
          setError("OAuth sign-in failed — no session created");
        }
        setIsLoading(false);
        void router.push("/dashboard");
      } catch (err) {
        console.error("OAuth callback error:", err);
        setError("Failed to process OAuth callback");
        setIsLoading(false);
      }
    };

    void handleOAuthCallback();
  }, [searchParams, router, isAuthenticated, login]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)] px-4">
        <div className="space-y-4 text-center">
          <div className="mx-auto size-8 animate-spin rounded-full border-2 border-[var(--color-rule)] border-t-[var(--hm-accent)]" />
          <p className="text-[var(--color-muted)]">Completing sign in…</p>
        </div>
      </div>
    );
  }

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
