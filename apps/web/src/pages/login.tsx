import { LoginForm } from "@/components/auth/login-form";
import { AuthSplitShell, SplitPanel, StickerCard } from "@/components/auth/auth-split-shell";
import { IconBrandWhatsapp, IconMail, IconMessage } from "@tabler/icons-react";
import Link from "@/compat/next-link";
import { Suspense } from "react";

function LoginPageContent() {
  return (
    <AuthSplitShell
      panel={
        <SplitPanel
          eyebrow="Sanarwa · notifications"
          headline={
            <>
              WELCOME
              <br />
              <span className="text-[var(--hm-accent)]">BACK.</span>
            </>
          }
          sub="Your workspace, keys and receipts — right where you left them."
          sticker={
            <StickerCard
              label="msg_7f3c91a0"
              primary="6/6 delivered"
              secondary="one message id · six receipts"
            />
          }
          chips={[
            { icon: IconMail, label: "Email" },
            { icon: IconMessage, label: "SMS" },
            { icon: IconBrandWhatsapp, label: "WhatsApp" },
          ]}
          footnote="One API · every channel"
          switchTo={
            <Link
              href="/register"
              className="text-[var(--hm-accent)] underline-offset-2 hover:underline"
            >
              Create account
            </Link>
          }
        />
      }
    >
      <LoginForm />
    </AuthSplitShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)]">
          <div className="size-8 animate-spin rounded-full border-2 border-[var(--color-rule)] border-t-[var(--hm-accent)]" />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

const metadata = {
  title: "Sign In - Sanarwa",
  description: "Sign in to your Sanarwa account",
};
