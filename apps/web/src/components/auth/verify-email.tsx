'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { authApi } from '@/lib/api/auth';
import Link from '@/compat/next-link';
import { useRouter, useSearchParams } from '@/compat/next-navigation';
import { useEffect, useState } from 'react';

export function VerifyEmail() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshUser } = useAuth();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'resend'>('verifying');
  const [error, setError] = useState('');
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (token) {
      verifyEmail(token);
    } else {
      setStatus('error');
      setError('Invalid verification link');
    }
  }, [token]);

  const verifyEmail = async (verificationToken: string) => {
    try {
      await authApi.verifyEmail({ token: verificationToken });
      setStatus('success');
      // Refresh user data to update email verification status
      await refreshUser();
    } catch (error) {
      setStatus('error');
      setError(error instanceof Error ? error.message : 'Email verification failed');
    }
  };

  const handleResendVerification = async () => {
    setIsResending(true);
    try {
      await authApi.resendVerificationEmail();
      setStatus('resend');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to resend verification email');
    } finally {
      setIsResending(false);
    }
  };

  const handleContinue = () => {
    router.push('/dashboard');
  };

  if (status === 'verifying') {
    return (
      <Card className="w-full max-w-md mx-auto p-6">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <h1 className="text-2xl font-bold">Verifying your email</h1>
          <p className="text-muted-foreground">
            Please wait while we verify your email address...
          </p>
        </div>
      </Card>
    );
  }

  if (status === 'success') {
    return (
      <Card className="w-full max-w-md mx-auto p-6">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold">Email verified!</h1>
          <p className="text-muted-foreground">
            Your email address has been successfully verified. You can now access all features of your account.
          </p>

          <Button onClick={handleContinue} className="w-full">
            Continue to Dashboard
          </Button>
        </div>
      </Card>
    );
  }

  if (status === 'resend') {
    return (
      <Card className="w-full max-w-md mx-auto p-6">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold">Verification email sent</h1>
          <p className="text-muted-foreground">
            We've sent a new verification email to your address. Please check your inbox and click the verification link.
          </p>

          <Link href="/dashboard">
            <Button variant="outline" className="w-full">
              Continue to Dashboard
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto p-6">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 mx-auto bg-red-100 rounded-full flex items-center justify-center">
          <svg
            className="w-6 h-6 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold">Verification failed</h1>
        <p className="text-muted-foreground">
          {error || 'We couldn\'t verify your email address. The link may be invalid or expired.'}
        </p>

        {user && !user.emailVerified && (
          <Button
            onClick={handleResendVerification}
            disabled={isResending}
            className="w-full"
          >
            {isResending ? 'Sending...' : 'Resend verification email'}
          </Button>
        )}

        <Link href="/dashboard">
          <Button variant="outline" className="w-full">
            Continue to Dashboard
          </Button>
        </Link>
      </div>
    </Card>
  );
}