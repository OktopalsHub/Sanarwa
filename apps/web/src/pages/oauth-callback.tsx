"use client";

import { useAuth } from "@/contexts/auth-context";
import { useRouter, useSearchParams } from "@/compat/next-navigation";
import { useEffect, useState } from "react";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        const accessToken = searchParams.get("access_token");
        const refreshToken = searchParams.get("refresh_token");
        const userStr = searchParams.get("user");
        const errorParam = searchParams.get("error");

        if (errorParam) {
          setError(decodeURIComponent(errorParam));
          setTimeout(() => router.push("/login"), 3000);
          return;
        }

        if (!accessToken || !userStr) {
          setError("Invalid OAuth callback parameters");
          setTimeout(() => router.push("/login"), 3000);
          return;
        }

        const user = JSON.parse(decodeURIComponent(userStr));

        // Store tokens manually since OAuth flow bypasses normal login
        if (typeof window !== "undefined") {
          localStorage.setItem("notifi_access_token", accessToken);
          if (refreshToken) {
            localStorage.setItem("notifi_refresh_token", refreshToken);
          }
        }

        // Redirect to dashboard
        router.push("/dashboard");
      } catch (error) {
        console.error("OAuth callback error:", error);
        setError("Failed to process OAuth callback");
        setTimeout(() => router.push("/login"), 3000);
      }
    };

    handleOAuthCallback();
  }, [searchParams, router, login]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <div className="text-destructive text-lg font-medium">Authentication Error</div>
          <p className="text-muted-foreground">{error}</p>
          <p className="text-sm text-muted-foreground">Redirecting to login page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground">Completing authentication...</p>
      </div>
    </div>
  );
}
