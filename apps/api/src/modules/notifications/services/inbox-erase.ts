import { Repository } from "typeorm";
import { InAppNotification } from "../../messaging/entities/in-app-notification.entity";

/**
 * Inbox erase seam (GDPR): removes Tenant inbox rows for a Subscriber identity.
 * Matches `subscriberId` and `userId` (both contracts over in_app_notifications).
 */
export async function eraseInboxBySubscriber(
  repository: Repository<InAppNotification>,
  tenantId: string,
  subscriberId: string,
): Promise<number> {
  const bySubscriber = await repository.delete({ tenantId, subscriberId });
  const byUser = await repository
    .createQueryBuilder()
    .delete()
    .where("tenant_id = :tenantId", { tenantId })
    .andWhere("user_id = :subscriberId", { subscriberId })
    .andWhere("(subscriber_id IS NULL OR subscriber_id <> :subscriberId)", { subscriberId })
    .execute();
  return (bySubscriber.affected ?? 0) + (byUser.affected ?? 0);
}
