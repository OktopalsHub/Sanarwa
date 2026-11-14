import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { TenantCreatedEvent } from "../../common/events/tenant.event";
import { ProjectService } from "./project.service";

export const DEFAULT_PROJECT_NAME = "Default";

@Injectable()
export class DefaultProjectListener {
  private readonly logger = new Logger(DefaultProjectListener.name);

  constructor(private readonly projectService: ProjectService) {}

  @OnEvent("tenant.created")
  async handleTenantCreated(event: TenantCreatedEvent): Promise<void> {
    const tenantId = event.tenant.id;

    try {
      await this.projectService.createProject(tenantId, {
        name: DEFAULT_PROJECT_NAME,
        description: "Created with your workspace.",
      });
      this.logger.log(`Created default project for tenant ${tenantId}`);
    } catch (error) {
      if (error instanceof ConflictException) {
        return;
      }
      this.logger.error(`Failed to create default project for tenant ${tenantId}`, error);
    }
  }
}
