import { ApiClient } from "./client";
import { ProjectHelpersClient } from "./project/project-helpers";

export class ProjectApiClient extends ProjectHelpersClient {
  constructor(apiClient?: ApiClient) {
    super(apiClient);
  }
}

export const projectApi = new ProjectApiClient();
