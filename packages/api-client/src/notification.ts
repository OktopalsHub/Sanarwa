import { ApiClient } from "./client";
import { NotificationHelpersClient } from "./notification/notification-helpers";

export class NotificationApiClient extends NotificationHelpersClient {
  constructor(apiClient?: ApiClient) {
    super(apiClient);
  }
}

export const notificationApi = new NotificationApiClient();
