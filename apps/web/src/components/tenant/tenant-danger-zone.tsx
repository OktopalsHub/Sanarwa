"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useTenant } from "@/contexts/tenant-context";
import { Tenant } from "@/lib/types/tenant";
import { ExclamationTriangleIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useRouter } from "@/compat/next-navigation";
import { useState } from "react";
import { toast } from "sonner";

interface TenantDangerZoneProps {
  tenant: Tenant;
}

export function TenantDangerZone({ tenant }: TenantDangerZoneProps) {
  const { deleteTenant, isLoading } = useTenant();
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const expectedConfirmationText = `delete ${tenant.slug}`;
  const canDelete = confirmationText === expectedConfirmationText;

  const handleDeleteTenant = async () => {
    if (!canDelete) return;

    setIsDeleting(true);
    try {
      await deleteTenant(tenant.id);
      toast.success("Organization deleted successfully");
      setDeleteDialogOpen(false);
      router.push("/dashboard");
    } catch (error) {
      toast.error("Failed to delete organization");
      console.error("Delete error:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTransferOwnership = async () => {
    // This would open a dialog to transfer ownership
    toast.info("Transfer ownership feature coming soon");
  };

  const handleLeaveOrganization = async () => {
    // This would allow the user to leave the organization
    toast.info("Leave organization feature coming soon");
  };

  return (
    <Card className="border-destructive/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 text-destructive" />
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
        </div>
        <CardDescription>
          Irreversible and destructive actions for this organization.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Transfer Ownership */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-1">
            <h4 className="font-medium">Transfer Ownership</h4>
            <p className="text-sm text-muted-foreground">
              Transfer ownership of this organization to another member.
            </p>
          </div>
          <Button onClick={handleTransferOwnership} variant="outline" disabled={isLoading}>
            Transfer
          </Button>
        </div>

        <Separator />

        {/* Leave Organization */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-1">
            <h4 className="font-medium">Leave Organization</h4>
            <p className="text-sm text-muted-foreground">
              Remove yourself from this organization. You will lose access immediately.
            </p>
          </div>
          <Button onClick={handleLeaveOrganization} variant="outline" disabled={isLoading}>
            Leave
          </Button>
        </div>

        <Separator />

        {/* Delete Organization */}
        <div className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg bg-destructive/5">
          <div className="space-y-1">
            <h4 className="font-medium text-destructive">Delete Organization</h4>
            <p className="text-sm text-muted-foreground">
              Permanently delete this organization and all associated data. This action cannot be
              undone.
            </p>
            <div className="text-xs text-muted-foreground mt-2">
              <p className="font-medium">This will delete:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>All campaigns and workflows</li>
                <li>Template library and branding</li>
                <li>Analytics and reporting data</li>
                <li>Team member access</li>
                <li>API keys and integrations</li>
              </ul>
            </div>
          </div>
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" disabled={isLoading}>
                <TrashIcon className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-5 w-5 text-destructive" />
                  Delete Organization
                </DialogTitle>
                <DialogDescription>
                  This action cannot be undone. This will permanently delete the{" "}
                  <span className="font-medium">{tenant.name}</span> organization and all associated
                  data.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <p className="text-sm font-medium text-destructive mb-2">
                    Warning: This will permanently delete:
                  </p>
                  <ul className="text-xs text-destructive/80 space-y-1">
                    <li>• All campaigns, workflows, and templates</li>
                    <li>• Analytics data and reporting history</li>
                    <li>• Team member access and permissions</li>
                    <li>• API keys and webhook configurations</li>
                    <li>• Billing history and subscription data</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmation">
                    Type <span className="font-mono font-medium">{expectedConfirmationText}</span>{" "}
                    to confirm:
                  </Label>
                  <Input
                    id="confirmation"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    placeholder={expectedConfirmationText}
                    className="font-mono"
                  />
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteDialogOpen(false);
                    setConfirmationText("");
                  }}
                  disabled={isDeleting}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteTenant}
                  disabled={!canDelete || isDeleting}
                  className="w-full sm:w-auto"
                >
                  <TrashIcon className="mr-2 h-4 w-4" />
                  {isDeleting ? "Deleting..." : "Delete Organization"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
