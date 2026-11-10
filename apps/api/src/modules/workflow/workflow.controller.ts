import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentTenantId } from "../../common/decorators";
import { TenantMemberGuard } from "../../common/guards";
import { AuthGuard } from "../auth/guards/jwt-auth.guard";
import { WorkflowService } from "./workflow.service";
import {
  CreateWorkflowDto,
  SignalWorkflowEventDto,
  StartWorkflowRunDto,
  UpdateWorkflowDto,
} from "./dto/workflow.dto";

@ApiTags("Workflows")
@ApiBearerAuth()
@Controller("tenants/:tenantId/workflows")
@UseGuards(AuthGuard, TenantMemberGuard)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a workflow" })
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateWorkflowDto) {
    return this.workflowService.create(tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: "List workflows" })
  async findAll(@CurrentTenantId() tenantId: string) {
    const workflows = await this.workflowService.findAll(tenantId);
    return { workflows, total: workflows.length };
  }

  @Get("runs")
  @ApiOperation({ summary: "List workflow runs" })
  async listRuns(@CurrentTenantId() tenantId: string, @Query("workflowId") workflowId?: string) {
    const runs = await this.workflowService.listRuns(tenantId, workflowId);
    return { runs, total: runs.length };
  }

  @Post("signal")
  @ApiOperation({ summary: "Signal an event to resume waiting workflow runs" })
  async signal(@CurrentTenantId() tenantId: string, @Body() dto: SignalWorkflowEventDto) {
    return this.workflowService.signal(tenantId, dto);
  }

  @Get("runs/:runId")
  @ApiOperation({ summary: "Get a workflow run" })
  async getRun(@CurrentTenantId() tenantId: string, @Param("runId") runId: string) {
    return this.workflowService.getRun(tenantId, runId);
  }

  @Post("runs/:runId/cancel")
  @ApiOperation({ summary: "Cancel a workflow run" })
  async cancelRun(@CurrentTenantId() tenantId: string, @Param("runId") runId: string) {
    return this.workflowService.cancelRun(tenantId, runId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a workflow" })
  async findOne(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return this.workflowService.findOne(tenantId, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a workflow" })
  async update(
    @CurrentTenantId() tenantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.workflowService.update(tenantId, id, dto);
  }

  @Post(":id/start")
  @ApiOperation({ summary: "Start a workflow run (durable steps)" })
  async start(
    @CurrentTenantId() tenantId: string,
    @Param("id") id: string,
    @Body() dto: StartWorkflowRunDto,
  ) {
    return this.workflowService.startRun(tenantId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a workflow" })
  @ApiResponse({ status: 204 })
  async remove(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    await this.workflowService.remove(tenantId, id);
  }
}
