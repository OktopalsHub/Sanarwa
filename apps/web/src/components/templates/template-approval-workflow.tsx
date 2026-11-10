"use client";

import { AlertTriangle, CheckCircle, Clock, XCircle } from "@/lib/icons";

import { Badge } from "@sanarwa/ui/badge";
import { Button } from "@sanarwa/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@sanarwa/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@sanarwa/ui/dialog";
import { Label } from "@sanarwa/ui/label";
import { ScrollArea } from "@sanarwa/ui/scroll-area";
import { Textarea } from "@sanarwa/ui/textarea";
import { templateApi } from "@sanarwa/api-client";
import type { ApprovalStatus, Template, TemplateApproval } from "@/lib/types/template";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ExclamationTriangleIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  UserIcon,
  DocumentTextIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import { toast } from "sonner";

interface TemplateApprovalWorkflowProps {
  templateId: string;
  template?: Template;
  onApprovalChange?: (approval: TemplateApproval) => void;
  className?: string;
}

const approvalStatusConfig = {
  pending: {
    label: "Pending Review",
    icon: Clock,
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle,
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  },
  needs_review: {
    label: "Needs Review",
    icon: AlertTriangle,
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  },
};

export function TemplateApprovalWorkflow({
  templateId,
  template,
  onApprovalChange,
  className,
}: TemplateApprovalWorkflowProps) {
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<TemplateApproval | null>(null);
  const [requestComments, setRequestComments] = useState("");
  const [reviewComments, setReviewComments] = useState("");
  const [reviewStatus, setReviewStatus] = useState<ApprovalStatus>("approved");
  const queryClient = useQueryClient();

  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ["template-approvals", templateId],
    queryFn: () => templateApi.getTemplateApprovals(templateId),
    enabled: !!templateId,
  });

  const requestApprovalMutation = useMutation({
    mutationFn: (comments: string) =>
      templateApi.requestApproval({
        templateId,
        comments,
      }),
    onSuccess: (approval) => {
      toast.success("Approval request submitted successfully");
      queryClient.invalidateQueries({ queryKey: ["template-approvals", templateId] });
      queryClient.invalidateQueries({ queryKey: ["template", templateId] });
      onApprovalChange?.(approval);
      setShowRequestDialog(false);
      setRequestComments("");
    },
    onError: (error) => {
      toast.error("Failed to submit approval request");
      console.error("Request approval error:", error);
    },
  });

  const reviewTemplateMutation = useMutation({
    mutationFn: ({
      approvalId,
      status,
      comments,
    }: {
      approvalId: string;
      status: ApprovalStatus;
      comments: string;
    }) => templateApi.reviewTemplate(approvalId, { approvalId, status, comments }),
    onSuccess: (approval) => {
      toast.success(
        `Template ${reviewStatus === "approved" ? "approved" : "rejected"} successfully`,
      );
      queryClient.invalidateQueries({ queryKey: ["template-approvals", templateId] });
      queryClient.invalidateQueries({ queryKey: ["template", templateId] });
      onApprovalChange?.(approval);
      setShowReviewDialog(false);
      setReviewComments("");
      setSelectedApproval(null);
    },
    onError: (error) => {
      toast.error("Failed to submit review");
      console.error("Review template error:", error);
    },
  });

  const handleRequestApproval = () => {
    requestApprovalMutation.mutate(requestComments);
  };

  const handleReviewTemplate = () => {
    if (!selectedApproval) return;

    reviewTemplateMutation.mutate({
      approvalId: selectedApproval.id,
      status: reviewStatus,
      comments: reviewComments,
    });
  };

  const openReviewDialog = (approval: TemplateApproval) => {
    setSelectedApproval(approval);
    setReviewStatus("approved");
    setReviewComments("");
    setShowReviewDialog(true);
  };

  const currentApproval = approvals.find((a) => a.status === "pending") || approvals[0];
  const canRequestApproval = !approvals.some((a) => a.status === "pending");
  const canReview = currentApproval?.status === "pending";

  return (
    <div className={cn("space-y-6", className)}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DocumentTextIcon className="h-5 w-5" />
              <CardTitle>Approval Status</CardTitle>
            </div>
            {canRequestApproval && (
              <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                    Request Approval
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Request Template Approval</DialogTitle>
                    <DialogDescription>
                      Submit this template for review and approval. Add any comments for the
                      reviewers.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="request-comments">Comments (Optional)</Label>
                      <Textarea
                        id="request-comments"
                        value={requestComments}
                        onChange={(e) => setRequestComments(e.target.value)}
                        placeholder="Add any notes or context for the reviewers..."
                        rows={4}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowRequestDialog(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleRequestApproval}
                      disabled={requestApprovalMutation.isPending}
                    >
                      Submit Request
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {currentApproval ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {(() => {
                  const config = approvalStatusConfig[currentApproval.status];
                  const StatusIcon = config.icon;
                  return (
                    <>
                      <Badge className={cn("text-xs", config.color)}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Version {currentApproval.version}
                      </span>
                    </>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <UserIcon className="h-3 w-3" />
                  <span>Requested by {currentApproval.requestedBy}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarIcon className="h-3 w-3" />
                  <span>{new Date(currentApproval.requestedAt).toLocaleDateString()}</span>
                </div>
              </div>

              {currentApproval.comments && (
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="text-sm font-medium mb-1">Request Comments:</p>
                  <p className="text-sm text-muted-foreground">{currentApproval.comments}</p>
                </div>
              )}

              {currentApproval.reviewerId && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <UserIcon className="h-3 w-3" />
                    <span>
                      Reviewed by {currentApproval.reviewerName || currentApproval.reviewerId}
                    </span>
                    {currentApproval.reviewedAt && (
                      <>
                        <span>•</span>
                        <span>{new Date(currentApproval.reviewedAt).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>

                  {currentApproval.comments && (
                    <div className="p-3 bg-muted/50 rounded-md">
                      <p className="text-sm font-medium mb-1">Review Comments:</p>
                      <p className="text-sm text-muted-foreground">{currentApproval.comments}</p>
                    </div>
                  )}
                </div>
              )}

              {canReview && (
                <div className="pt-2 border-t">
                  <Button size="sm" onClick={() => openReviewDialog(currentApproval)}>
                    <EyeIcon className="h-4 w-4 mr-2" />
                    Review Template
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <DocumentTextIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No approval requests yet</p>
              <p className="text-sm">Submit this template for review when ready</p>
            </div>
          )}
        </CardContent>
      </Card>

      {approvals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Approval History</CardTitle>
            <CardDescription>
              Track all approval requests and reviews for this template
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-4">
                {approvals.map((approval, index) => {
                  const config = approvalStatusConfig[approval.status];
                  const StatusIcon = config.icon;

                  return (
                    <div key={approval.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center",
                            config.color,
                          )}
                        >
                          <StatusIcon className="h-4 w-4" />
                        </div>
                        {index < approvals.length - 1 && (
                          <div className="w-px h-8 bg-border mt-2" />
                        )}
                      </div>

                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {config.label}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            Version {approval.version}
                          </span>
                        </div>

                        <div className="text-sm space-y-1">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <UserIcon className="h-3 w-3" />
                            <span>Requested by {approval.requestedBy}</span>
                            <span>•</span>
                            <span>{new Date(approval.requestedAt).toLocaleDateString()}</span>
                          </div>

                          {approval.reviewerId && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <UserIcon className="h-3 w-3" />
                              <span>
                                Reviewed by {approval.reviewerName || approval.reviewerId}
                              </span>
                              {approval.reviewedAt && (
                                <>
                                  <span>•</span>
                                  <span>{new Date(approval.reviewedAt).toLocaleDateString()}</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {approval.comments && (
                          <div className="p-2 bg-muted/30 rounded text-sm">
                            <ChatBubbleLeftRightIcon className="h-3 w-3 inline mr-1" />
                            {approval.comments}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Template</DialogTitle>
            <DialogDescription>
              Review and approve or reject this template submission.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Review Decision</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  variant={reviewStatus === "approved" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setReviewStatus("approved")}
                >
                  <CheckCircleIcon className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  variant={reviewStatus === "rejected" ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => setReviewStatus("rejected")}
                >
                  <XCircleIcon className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  variant={reviewStatus === "needs_review" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setReviewStatus("needs_review")}
                >
                  <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
                  Needs Changes
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="review-comments">
                Comments{" "}
                {reviewStatus !== "approved" && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                id="review-comments"
                value={reviewComments}
                onChange={(e) => setReviewComments(e.target.value)}
                placeholder={
                  reviewStatus === "approved"
                    ? "Add any approval notes (optional)..."
                    : "Explain what needs to be changed or why this was rejected..."
                }
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReviewTemplate}
              disabled={
                reviewTemplateMutation.isPending ||
                (reviewStatus !== "approved" && !reviewComments.trim())
              }
            >
              Submit Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
