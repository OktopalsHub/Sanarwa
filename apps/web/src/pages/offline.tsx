'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HomeIcon, ArrowPathIcon, WifiIcon } from '@heroicons/react/24/outline'


// Metadata is handled by layout.tsx for client components

export default function OfflinePage() {
  const handleRetry = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-muted rounded-full flex items-center justify-center">
            <WifiIcon className="w-8 h-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">You're Offline</CardTitle>
          <CardDescription>
            It looks like you've lost your internet connection. Some features may not be available.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>While you're offline, you can still:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>View previously loaded content</li>
              <li>Access cached data</li>
              <li>Use basic navigation</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={handleRetry}
              className="flex-1"
              aria-label="Retry connection"
            >
              <ArrowPathIcon className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <Button
              onClick={handleGoHome}
              variant="outline"
              className="flex-1"
              aria-label="Go to home page"
            >
              <HomeIcon className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            Your data will sync automatically when you're back online.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}