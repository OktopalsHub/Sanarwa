import { Button } from "@sanarwa/ui/button";
import { Card } from "@sanarwa/ui/card";
import { ShieldExclamationIcon } from "@heroicons/react/24/outline";

import Link from "@/compat/next-link";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-6">
        <div className="text-center space-y-4">
          <ShieldExclamationIcon className="w-12 h-12 mx-auto text-destructive" />

          <h1 className="text-xl font-semibold tracking-tight">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to access this resource or you're not a member of the selected
            organization.
          </p>

          <div className="space-y-2">
            <Link href="/dashboard">
              <Button className="w-full">Go to Dashboard</Button>
            </Link>

            <Link href="/onboarding">
              <Button variant="outline" className="w-full">
                Select Organization
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

const metadata = {
  title: "Unauthorized - Sanarwa",
  description: "You do not have permission to access this resource",
};
