import { RegisterForm } from '@/components/auth/register-form';
import { RegisterPageLayout } from '@/components/auth/register-page-layout';
import { Suspense } from 'react';

function RegisterPageContent() {
  return (
    <RegisterPageLayout>
      <RegisterForm />
    </RegisterPageLayout>
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

export const metadata = {
  title: 'Sign Up - Sanarwa',
  description: 'Create your Sanarwa account',
};
