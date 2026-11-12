import { RegisterForm } from "@/components/auth/register-form";
import { AuthSplitShell, SplitPanel, StickerCard } from "@/components/auth/auth-split-shell";
import { IconKey, IconReceipt, IconWebhook } from "@tabler/icons-react";
import Link from "@/compat/next-link";
import { formatTokens, WELCOME_SIGNUP_TOKENS } from "@/lib/pricing";
import { Suspense } from "react";

function RegisterPageContent() {
  return (
    <AuthSplitShell
      panel={
        <SplitPanel
          eyebrow="Sanarwa · notifications"
          headline={
            <>
              START
              <br />
              <span className="text-[var(--hm-accent)]">SENDING.</span>
            </>
          }
          sub="One account for every channel you send through — email, SMS, WhatsApp, push, in-app and voice."
          sticker={
            <StickerCard
              label="POST /api/v1/messaging/send"
              primary="201 created"
              secondary="X-API-Key · msg_7f3c91a0"
            />
          }
          chips={[
            { icon: IconKey, label: "Keys" },
            { icon: IconReceipt, label: "Receipts" },
            { icon: IconWebhook, label: "Webhooks" },
          ]}
          footnote={`${formatTokens(WELCOME_SIGNUP_TOKENS)} tokens on signup`}
          switchTo={
            <Link
              href="/login"
              className="text-[var(--hm-accent)] underline-offset-2 hover:underline"
            >
              Sign in
            </Link>
          }
        />
      }
    >
      <RegisterForm />
    </AuthSplitShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)]">
          <div className="size-8 animate-spin rounded-full border-2 border-[var(--color-rule)] border-t-[var(--hm-accent)]" />
        </div>
      }
    >
      <RegisterPageContent />
    </Suspense>
  );
}

const metadata = {
  title: "Sign Up - Sanarwa",
  description: "Create your Sanarwa account",
};
