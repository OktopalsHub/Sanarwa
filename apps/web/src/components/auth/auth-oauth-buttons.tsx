"use client";

import { Button } from "@/components/ui/button";
import { GitHubIcon, GoogleIcon } from "@/components/auth/auth-oauth-icons";

function oauthBaseUrl(): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) {
    return String(import.meta.env.VITE_API_URL);
  }
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) {
    return String(process.env.NEXT_PUBLIC_API_URL);
  }
  return "http://localhost:9000/api/v1";
}

export function redirectToOAuth(provider: "google" | "github") {
  window.location.href = `${oauthBaseUrl()}/auth/oauth/${provider}`;
}

const oauthBtnClass =
  "h-11 w-full rounded-[var(--radius-input)] border-[var(--color-rule)] bg-[var(--color-paper-2)] font-medium text-[var(--color-ink)] shadow-[var(--shadow-card)] transition-[background-color,border-color,transform] duration-[var(--dur-micro)] ease-[var(--ease-out)] hover:border-[var(--color-rule-2)] hover:bg-[var(--color-paper-3)] focus-visible:border-[var(--color-focus)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]/25 active:translate-y-px disabled:opacity-50";

interface AuthOAuthButtonsProps {
  disabled?: boolean;
  actionLabel?: "Login" | "Sign up";
}

export function AuthOAuthButtons({ disabled, actionLabel = "Login" }: AuthOAuthButtonsProps) {
  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className={oauthBtnClass}
        onClick={() => redirectToOAuth("google")}
        disabled={disabled}
      >
        <GoogleIcon />
        {actionLabel} with Google
      </Button>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className={oauthBtnClass}
        onClick={() => redirectToOAuth("github")}
        disabled={disabled}
      >
        <GitHubIcon />
        {actionLabel} with GitHub
      </Button>
    </div>
  );
}
