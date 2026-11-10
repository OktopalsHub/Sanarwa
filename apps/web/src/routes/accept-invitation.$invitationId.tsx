import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/better-auth-client";

export const Route = createFileRoute("/accept-invitation/$invitationId")({
  component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
  const { invitationId } = Route.useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [message, setMessage] = useState<string>("Accepting invitation…");

  useEffect(() => {
    (async () => {
      try {
        const session = await authClient.getSession();
        if (!session.data?.user) {
          setStatus("error");
          setMessage("Please sign in first, then open this invitation link again.");
          return;
        }
        const result = (await authClient.organization.acceptInvitation({ invitationId })) as any;
        if (result?.error) throw new Error(result.error.message ?? "Could not accept invitation");
        setStatus("done");
        setMessage("Invitation accepted. Opening your workspace…");
        const orgId =
          result?.data?.organizationId ??
          result?.data?.membership?.organizationId ??
          result?.data?.id;
        if (orgId) {
          await authClient.organization.setActive({ organizationId: orgId });
        }
        setTimeout(() => void navigate({ to: "/dashboard" }), 800);
      } catch (err) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Could not accept invitation");
      }
    })();
  }, [invitationId, navigate]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Invitation</h1>
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {status === "loading" ? message : message}
      </p>
      {status === "error" ? (
        <a className="underline" href="/login">
          Go to sign in
        </a>
      ) : null}
    </main>
  );
}
