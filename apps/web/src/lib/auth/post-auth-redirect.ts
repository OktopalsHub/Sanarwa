import { tenantApi } from "@/lib/api/tenant";
import { getTenantPathSegment } from "@/lib/tenant-path";
import { getApiErrorMessage } from "@/lib/utils/api-error-message";
import { toast } from "@/lib/utils/toast";

type RouterLike = { push: (href: string) => void };

export async function redirectAfterAuth(router: RouterLike): Promise<void> {
  try {
    const tenants = await tenantApi.getMyTenants({ limit: 50 });

    if (tenants.length > 0) {
      router.push(`/${getTenantPathSegment(tenants[0]!)}/dashboard`);
      return;
    }

    router.push("/onboarding");
  } catch (error) {
    toast.error(getApiErrorMessage(error, "Signed in, but we could not load your workspaces"));
    router.push("/onboarding");
  }
}
