import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, LessThanOrEqual, Repository } from "typeorm";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { UnifiedSendService } from "../messaging/unified-send.service";
import {
  ConditionStep,
  DelayStep,
  ForeachStep,
  ParallelStep,
  SendStep,
  SetStep,
  Workflow,
  WorkflowStep,
} from "./entities/workflow.entity";
import { WorkflowRun } from "./entities/workflow-run.entity";
import {
  CreateWorkflowDto,
  SignalWorkflowEventDto,
  StartWorkflowRunDto,
  UpdateWorkflowDto,
} from "./dto/workflow.dto";
import {
  dotGet,
  normalizeScheduleMetadata,
  withSchemaVersion,
  publicContext,
  validateWorkflowSteps,
} from "./workflow-steps";

const CHANNELS = new Set<string>(Object.values(NotificationChannel));
const MAX_STEPS_PER_TICK = 50;
const MAX_SIGNAL_KEYS = 50;

export interface NestFrame {
  kind: "foreach" | "parallel";
  /** Index of the owning construct in its parent array. */
  index: number;
  /** foreach: current item; parallel: current branch. */
  i: number;
  /** Step cursor within the current sub-array. */
  subStep: number;
  /** foreach: number of items; parallel: number of branches. */
  total: number;
  /** foreach only: the iterable snapshot. */
  items: unknown[];
  onError: "fail" | "skip";
  mode: "all" | "any";
  itemsKey: string;
  as: string;
  indexAs: string;
  park: "delay" | "retry" | "event" | null;
  /** Send-retry counter for the current sub-step. */
  retryCount: number;
  results: Array<{ status: "completed" | "failed"; error?: string }>;
}

export interface StepLocation {
  /** The (sub-)array the cursor indexes into. */
  array: WorkflowStep[];
  /** Current cursor within `array` (loc.depth === 0 mirrors run.currentStep). */
  index: number;
  /** Active nesting stack; empty at top level. */
  frames: NestFrame[];
  depth: number;
}

@Injectable()
export class WorkflowService implements OnModuleInit {
  private readonly logger = new Logger(WorkflowService.name);

  async onModuleInit(): Promise<void> {
    await this.recoverInterruptedRuns();
  }

  constructor(
    @InjectRepository(Workflow)
    private readonly workflows: Repository<Workflow>,
    @InjectRepository(WorkflowRun)
    private readonly runs: Repository<WorkflowRun>,
    private readonly unifiedSendService: UnifiedSendService,
  ) {}

  async create(tenantId: string, dto: CreateWorkflowDto): Promise<Workflow> {
    const { steps, errors } = validateWorkflowSteps(dto.steps ?? []);
    if (errors.length > 0) {
      throw new BadRequestException({ message: "Invalid workflow steps", errors });
    }

    const trigger = dto.trigger ?? "manual";
    const { metadata } = this.prepareScheduleTrigger(
      trigger,
      withSchemaVersion(dto.metadata ?? {}),
      new Date(),
    );

    const workflow = this.workflows.create({
      tenantId,
      name: dto.name,
      description: dto.description,
      trigger,
      status: dto.status ?? "active",
      steps,
      metadata,
    });
    return this.workflows.save(workflow);
  }

  async findAll(tenantId: string): Promise<Workflow[]> {
    return this.workflows.find({ where: { tenantId }, order: { createdAt: "DESC" } });
  }

  async findOne(tenantId: string, id: string): Promise<Workflow> {
    const workflow = await this.workflows.findOne({ where: { id, tenantId } });
    if (!workflow) {
      throw new NotFoundException("Workflow not found");
    }
    return workflow;
  }

  async update(tenantId: string, id: string, dto: UpdateWorkflowDto): Promise<Workflow> {
    const workflow = await this.findOne(tenantId, id);
    if (dto.name !== undefined) workflow.name = dto.name;
    if (dto.description !== undefined) workflow.description = dto.description;
    if (dto.trigger !== undefined) workflow.trigger = dto.trigger;
    if (dto.status !== undefined) workflow.status = dto.status;
    if (dto.steps !== undefined) {
      const { steps, errors } = validateWorkflowSteps(dto.steps);
      if (errors.length > 0) {
        throw new BadRequestException({ message: "Invalid workflow steps", errors });
      }
      workflow.steps = steps;
    }
    if (dto.metadata !== undefined) workflow.metadata = dto.metadata;
    if (dto.trigger !== undefined || dto.metadata !== undefined) {
      const { metadata } = this.prepareScheduleTrigger(
        workflow.trigger,
        workflow.metadata ?? {},
        new Date(),
      );
      workflow.metadata = metadata;
    }
    return this.workflows.save(workflow);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const workflow = await this.findOne(tenantId, id);
    await this.workflows.remove(workflow);
  }

  /** Returns an API-safe copy of the run; the persisted row keeps the engine state. */
  /**
   * Validates and normalizes the schedule block for trigger=schedule
   * definitions. Manual/event triggers pass the metadata through untouched.
   */
  private prepareScheduleTrigger(
    trigger: string,
    metadata: Record<string, unknown>,
    now: Date,
  ): { metadata: Record<string, unknown> } {
    if (trigger !== "schedule") {
      return { metadata };
    }
    const result = normalizeScheduleMetadata(metadata, now);
    if (result.errors.length > 0) {
      throw new BadRequestException({
        message: "Invalid workflow schedule",
        errors: result.errors,
      });
    }
    if (!("metadata" in result)) {
      throw new BadRequestException({
        message: "Invalid workflow schedule",
        errors: ["unknown schedule error"],
      });
    }
    return { metadata: result.metadata };
  }

  /**
   * Cron: starts runs for trigger=schedule definitions whose
   * metadata.schedule.nextRunAt is due, then recomputes the next fire time.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processDueSchedules(): Promise<void> {
    const now = new Date();
    const candidates = await this.workflows.find({
      where: { trigger: "schedule", status: "active" },
      take: 100,
    });

    for (const workflow of candidates) {
      try {
        const schedule = (workflow.metadata as any)?.schedule;
        const nextRunAt =
          schedule && typeof schedule.nextRunAt === "string" ? new Date(schedule.nextRunAt) : null;
        if (
          !nextRunAt ||
          Number.isNaN(nextRunAt.getTime()) ||
          nextRunAt.getTime() > now.getTime()
        ) {
          continue;
        }
        const intervalMs =
          typeof schedule?.intervalMs === "number" && Number.isFinite(schedule.intervalMs)
            ? schedule.intervalMs
            : 60_000;
        const followingRunAt = new Date(now.getTime() + intervalMs).toISOString();
        const claimed = await this.advanceScheduleDefinition(
          workflow.id,
          schedule.nextRunAt as string,
          followingRunAt,
        );
        if (!claimed) {
          this.logger.warn(
            `Due schedule definition ${workflow.id} already advanced by another tick; skipping`,
          );
          continue;
        }
        await this.startRun(workflow.tenantId, workflow.id, { context: {} });
      } catch (error) {
        this.logger.warn(
          `Due schedule for workflow ${workflow.id} failed: ${(error as Error).message}`,
        );
      }
    }
  }

  private sanitizeRun(run: WorkflowRun): WorkflowRun {
    return {
      ...run,
      context: publicContext(run.context as Record<string, unknown>) as any,
    } as WorkflowRun;
  }

  async startRun(
    tenantId: string,
    workflowId: string,
    dto: StartWorkflowRunDto = {},
  ): Promise<WorkflowRun> {
    const workflow = await this.findOne(tenantId, workflowId);
    if (workflow.status !== "active") {
      throw new BadRequestException(`Workflow is ${workflow.status} and cannot be started`);
    }

    const run = this.runs.create({
      tenantId,
      workflowId: workflow.id,
      status: "running",
      currentStep: typeof dto.step === "number" && dto.step >= 0 ? Math.floor(dto.step) : 0,
      context: { ...(dto.context ?? {}), workflowId: workflow.id },
      waitEvent: null,
      waitUntil: null,
      errorMessage: null,
      startedAt: new Date(),
      completedAt: null,
    });
    const saved = await this.runs.save(run);
    return this.sanitizeRun(await this.advanceRun(saved.id));
  }

  async listRuns(tenantId: string, workflowId?: string): Promise<WorkflowRun[]> {
    const runs = await this.runs.find({
      where: workflowId ? { tenantId, workflowId } : { tenantId },
      order: { createdAt: "DESC" },
      take: 200,
    });
    return runs.map((run) => this.sanitizeRun(run));
  }

  async getRun(tenantId: string, runId: string): Promise<WorkflowRun> {
    const run = await this.runs.findOne({ where: { id: runId, tenantId } });
    if (!run) {
      throw new NotFoundException("Workflow run not found");
    }
    return this.sanitizeRun(run);
  }

  async cancelRun(tenantId: string, runId: string): Promise<WorkflowRun> {
    const run = await this.getRun(tenantId, runId);
    if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
      return run;
    }
    run.status = "cancelled";
    run.completedAt = new Date();
    run.waitEvent = null;
    run.waitUntil = null;
    return this.sanitizeRun(await this.runs.save(run));
  }

  async signal(
    tenantId: string,
    dto: SignalWorkflowEventDto,
  ): Promise<{ resumed: number; started: number }> {
    const where: Record<string, unknown> = {
      tenantId,
      status: "waiting_for_event",
      waitEvent: dto.event,
    };
    if (dto.workflowId) where.workflowId = dto.workflowId;
    if (dto.runId) where.id = dto.runId;

    const waiting = await this.runs.find({ where: where as any });
    let resumed = 0;
    for (const run of waiting) {
      if (dto.idempotencyKey && this.hasSignalKey(run, dto.idempotencyKey)) {
        continue;
      }
      run.context = {
        ...(run.context ?? {}),
        event: dto.payload ?? {},
        lastEvent: dto.event,
        ...(dto.idempotencyKey ? this.withSignalKey(run, dto.idempotencyKey) : {}),
      };
      run.status = "running";
      run.waitEvent = null;
      run.waitUntil = null;
      const frames = this.framesOf(run.context);
      if (frames.length > 0) {
        const inner = this.innermost(frames);
        inner.park = null;
        inner.subStep += 1; // advance past the wait_for_event sub-step
        this.setFrames(run, frames);
      } else {
        run.currentStep += 1; // advance past the wait_for_event step
      }
      await this.runs.save(run);
      await this.advanceRun(run.id);
      resumed++;
    }

    // Auto-start event-triggered workflow definitions (unless targeting a specific run).
    let started = 0;
    if (!dto.runId) {
      const defs = await this.workflows.find({
        where: { tenantId, trigger: "event", status: "active" },
      });
      const autoMarker = dto.idempotencyKey ? `auto:${dto.idempotencyKey}` : undefined;
      for (const wf of defs) {
        if (dto.workflowId && wf.id !== dto.workflowId) continue;
        const triggerEvent = (wf.metadata as any)?.event;
        if (typeof triggerEvent === "string" && triggerEvent && triggerEvent !== dto.event) {
          continue;
        }
        if (autoMarker) {
          const already = await this.runs.findOne({
            where: {
              tenantId,
              workflowId: wf.id,
              status: In(["running", "waiting", "waiting_for_event"]),
              context: { _signalKeys: [autoMarker] } as any,
            },
          });
          if (already) continue;
        }
        try {
          await this.startRun(tenantId, wf.id, {
            context: {
              event: dto.payload ?? {},
              lastEvent: dto.event,
              ...(autoMarker ? { _signalKeys: [autoMarker] } : {}),
            },
          });
          started++;
        } catch (error) {
          this.logger.warn(`Failed to start event workflow ${wf.id}: ${(error as Error).message}`);
        }
      }
    }

    return { resumed, started };
  }

  private hasSignalKey(run: WorkflowRun, key: string): boolean {
    const keys = (run.context as any)?._signalKeys;
    return Array.isArray(keys) && keys.includes(key);
  }

  private withSignalKey(run: WorkflowRun, key: string): { _signalKeys: string[] } {
    const prev = Array.isArray((run.context as any)?._signalKeys)
      ? ((run.context as any)._signalKeys as string[])
      : [];
    const next = [...prev.filter((k) => k !== key), key].slice(-MAX_SIGNAL_KEYS);
    return { _signalKeys: next };
  }

  /**
   * Cron: resumes runs whose wait/delay/timeout has elapsed, and re-enters runs
   * that yielded because they hit the per-tick step cap.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processDueWaits(): Promise<void> {
    const now = new Date();
    const due = await this.runs.find({
      where: [
        { status: "waiting", waitUntil: LessThanOrEqual(now) },
        { status: "waiting_for_event", waitUntil: LessThanOrEqual(now) },
      ],
      take: 100,
    });

    for (const run of due) {
      try {
        const claimed = await this.claimRun(run.id, [run.status]);
        if (!claimed) continue;
        const frames = this.framesOf(run.context);
        if (run.status === "waiting_for_event" && frames.length === 0) {
          run.status = "failed";
          run.errorMessage = `Timed out waiting for event '${run.waitEvent ?? ""}'`;
          run.completedAt = now;
          run.waitEvent = null;
          run.waitUntil = null;
          await this.runs.save(run);
          continue;
        }
        if (frames.length > 0) {
          const inner = this.innermost(frames);
          const parkedFor = inner.park ?? "delay";
          if (run.status === "waiting_for_event") {
            if (inner.onError === "skip") {
              // Skip the timed-out unit (foreach item / parallel branch).
              const steps = await this.workflowStepsFor(run);
              run.waitEvent = null;
              run.waitUntil = null;
              inner.park = null;
              await this.endCurrentUnitWithSkip(
                run,
                frames,
                run.errorMessage ?? "Timed out waiting for event",
                steps,
              );
              this.setFrames(run, frames);
              await this.runs.save(run);
              await this.advanceRun(run.id);
              continue;
            }
            run.status = "failed";
            run.errorMessage = `Timed out waiting for event '${run.waitEvent ?? ""}'`;
            run.completedAt = now;
            run.waitEvent = null;
            run.waitUntil = null;
            await this.runs.save(run);
            continue;
          }
          if (parkedFor === "delay") {
            inner.subStep += 1; // advance past the delay/wait sub-step
          }
          inner.park = null;
          const steps = await this.workflowStepsFor(run);
          await this.completeLevelFrames(run, frames, steps);
          this.setFrames(run, frames);
          run.status = "running";
          run.waitUntil = null;
          run.waitEvent = null;
          await this.runs.save(run);
          await this.advanceRun(run.id);
          continue;
        }
        const retrySame = (run.context as any)?._retryStep === run.currentStep;
        run.status = "running";
        run.waitUntil = null;
        if (!retrySame) {
          run.currentStep += 1; // advance past delay/wait step
        }
        if (retrySame) {
          const { _retryStep, ...rest } = (run.context ?? {}) as any;
          run.context = rest;
        }
        await this.runs.save(run);
        await this.advanceRun(run.id);
      } catch (error) {
        this.logger.warn(`Failed advancing run ${run.id}: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Atomically claims a run for the caller by moving it out of the expected
   * status(es). Returns whether the claim succeeded; a lost race means another
   * writer owns the run right now.
   */
  private async claimRun(runId: string, expected: string[]): Promise<boolean> {
    const result = await this.runs
      .createQueryBuilder()
      .update()
      .set({ status: "running" as WorkflowRun["status"] })
      .where("id = :id", { id: runId })
      .andWhere("status IN (:...expected)", { expected })
      .execute();
    return (result.affected ?? 0) === 1;
  }

  /**
   * Atomically advances a due definition's `metadata.schedule.nextRunAt`.
   * Another tick (or node) loses the compare-and-swap and must skip starting
   * a duplicate run.
   */
  private async advanceScheduleDefinition(
    workflowId: string,
    expectedNextRunAt: string,
    followingRunAt: string,
  ): Promise<boolean> {
    const result = await this.workflows
      .createQueryBuilder()
      .update()
      .set({
        metadata: () =>
          `jsonb_set("workflows"."metadata", '{schedule,nextRunAt}', to_jsonb(:v::text))`,
      })
      .where("id = :id", { id: workflowId })
      .andWhere("metadata->'schedule'->>'nextRunAt' = :expected", { expected: expectedNextRunAt })
      .setParameter("v", followingRunAt)
      .execute();
    return (result.affected ?? 0) === 1;
  }

  /**
   * Re-parks runs stranded in `running` by a crash or kill. They are picked
   * up by the cron on the next tick instead of being wedged forever.
   */
  async recoverInterruptedRuns(): Promise<number> {
    const now = new Date();
    const result = await this.runs.update(
      { status: "running" },
      { status: "waiting", waitUntil: now },
    );
    const count = result.affected ?? 0;
    if (count > 0) {
      this.logger.warn(`Recovered ${count} workflow run(s) stranded in 'running'`);
    }
    return count;
  }

  private framesOf(context: unknown): NestFrame[] {
    const raw = (context as any)?._frames;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    const frames: NestFrame[] = [];
    for (const entry of raw) {
      if (
        !entry ||
        typeof entry !== "object" ||
        (entry.kind !== "foreach" && entry.kind !== "parallel") ||
        !Number.isInteger(entry.index) ||
        !Number.isInteger(entry.i) ||
        !Number.isInteger(entry.subStep) ||
        !Number.isInteger(entry.total)
      ) {
        this.logger.warn(
          "workflow run has a corrupt _frames entry; refusing to resume nested state",
        );
        return [];
      }
      frames.push(entry as NestFrame);
    }
    return frames;
  }

  private innermost(frames: NestFrame[]): NestFrame {
    return frames[frames.length - 1];
  }

  private setFrames(run: WorkflowRun, frames: NestFrame[]): void {
    const ctx = (run.context ?? {}) as any;
    if (frames.length === 0) {
      const { _frames, ...rest } = ctx;
      run.context = rest;
      return;
    }
    run.context = { ...ctx, _frames: frames } as any;
  }

  /** Descends `depth` frame levels into the topology and returns the sub-array at that level. */
  private arrayAtDepth(steps: WorkflowStep[], frames: NestFrame[], depth: number): WorkflowStep[] {
    let array = steps;
    for (let d = 0; d < depth; d += 1) {
      const frame = frames[d];
      const construct = array[frame.index] as any;
      if (!construct) return [];
      if (frame.kind === "foreach") {
        array = Array.isArray(construct.steps) ? construct.steps : [];
      } else {
        const branches = Array.isArray(construct.branches) ? construct.branches : [];
        array = Array.isArray(branches[frame.i]) ? branches[frame.i] : [];
      }
    }
    return array;
  }

  /** Workflow steps for a run, loading the definition when not already in scope. */
  private async workflowStepsFor(
    run: WorkflowRun,
    steps?: WorkflowStep[],
  ): Promise<WorkflowStep[]> {
    if (steps) return steps;
    const workflow = await this.workflows.findOne({
      where: { id: run.workflowId, tenantId: run.tenantId },
    });
    return Array.isArray(workflow?.steps) ? workflow.steps : [];
  }

  /** Bundles the current cursor into one location object handlers read/write. */
  private async makeLocation(run: WorkflowRun, steps: WorkflowStep[]): Promise<StepLocation> {
    const frames = this.framesOf(run.context);
    if (frames.length === 0) {
      return { array: steps, index: run.currentStep, frames: [], depth: 0 };
    }
    const array = this.arrayAtDepth(steps, frames, frames.length);
    const inner = this.innermost(frames);
    return { array, index: inner.subStep, frames, depth: frames.length };
  }

  /** Writes loc.index back to the right cursor (top-level or innermost frame). */
  private syncLocation(run: WorkflowRun, loc: StepLocation): void {
    if (loc.frames.length === 0) {
      run.currentStep = loc.index;
      return;
    }
    const inner = this.innermost(loc.frames);
    inner.subStep = loc.index;
    this.setFrames(run, loc.frames);
  }

  /**
   * Marks the current unit (foreach item / parallel branch) as failed and
   * advances to the next one, or ends the construct. Used when the innermost
   * frame's onError is "skip".
   */
  private async endCurrentUnitWithSkip(
    run: WorkflowRun,
    frames: NestFrame[],
    error: string,
    steps: WorkflowStep[],
  ): Promise<void> {
    const inner = this.innermost(frames);
    inner.results[inner.i] = { status: "failed", error };
    run.status = "running";
    run.errorMessage = null;
    run.completedAt = null;

    // Skip the remainder of this unit's sub-steps; the level completer records
    // the outcome and advances/pops the construct.
    const subArray = this.arrayAtDepth(steps, frames, frames.length);
    inner.subStep = subArray.length;
    await this.completeLevelFrames(run, frames, steps);
  }

  /** Per-item advance for a completed (or skipped) foreach unit. */
  private advanceForeach(run: WorkflowRun, frames: NestFrame[]): void {
    const inner = this.innermost(frames);
    if (inner.i < inner.total - 1) {
      inner.i += 1;
      inner.subStep = 0;
      inner.retryCount = 0;
      inner.park = null;
      const items = Array.isArray(inner.items) ? inner.items : [];
      const item = items[inner.i];
      run.context = {
        ...((run.context ?? {}) as any),
        [inner.as]: item,
        [inner.indexAs]: inner.i,
        _frames: frames,
      } as any;
      return;
    }
    // Caller (completeLevelFrames) pops the construct; this binds the next item.
  }

  /** Removes the innermost construct; advances the level above (cascading). */
  private async popConstruct(
    run: WorkflowRun,
    frames: NestFrame[],
    steps: WorkflowStep[],
  ): Promise<void> {
    const inner = frames[frames.length - 1];
    if (inner.kind === "foreach") {
      const { [inner.as]: _a, [inner.indexAs]: _b, ...rest } = (run.context ?? {}) as any;
      run.context = rest;
    }
    frames.pop();
    if (frames.length === 0) {
      run.currentStep += 1;
      const rest = (run.context ?? {}) as any;
      const { _frames, ...cleaned } = rest;
      run.context = cleaned;
      return;
    }
    this.setFrames(run, frames);
    const parent = frames[frames.length - 1];
    parent.subStep += 1;
    await this.completeLevelFrames(run, frames, steps);
  }

  /** Pops completed constructs recursively while innermost sub-arrays are exhausted. */
  private async completeLevelFrames(
    run: WorkflowRun,
    frames: NestFrame[],
    steps: WorkflowStep[],
  ): Promise<void> {
    while (frames.length > 0) {
      const inner = this.innermost(frames);
      const subArray = this.arrayAtDepth(steps, frames, frames.length);
      if (inner.subStep < subArray.length) break;

      if (inner.kind === "foreach") {
        inner.results[inner.i] ??= { status: "completed" };
        const atLastItem = inner.i === inner.total - 1;
        if (atLastItem) {
          await this.popConstruct(run, frames, steps);
          continue;
        }
        this.advanceForeach(run, frames);
        continue;
      }

      inner.results[inner.i] ??= { status: "completed" };
      if (inner.mode === "any" && inner.results.some((r) => r?.status === "completed")) {
        await this.popConstruct(run, frames, steps);
        continue;
      }

      const next = inner.i + 1;
      if (next < inner.total) {
        inner.i = next;
        inner.subStep = 0;
        inner.retryCount = 0;
        inner.park = null;
        continue;
      }
      await this.popConstruct(run, frames, steps);
    }
  }

  private async advanceRun(runId: string): Promise<WorkflowRun> {
    let run = await this.runs.findOne({ where: { id: runId } });
    if (!run) {
      throw new NotFoundException("Workflow run not found");
    }
    if (run.status !== "running") {
      return run;
    }

    const workflow = await this.workflows.findOne({
      where: { id: run.workflowId, tenantId: run.tenantId },
    });
    if (!workflow) {
      run.status = "failed";
      run.errorMessage = "Workflow definition not found";
      run.completedAt = new Date();
      return this.runs.save(run);
    }

    const steps = Array.isArray(workflow.steps) ? workflow.steps : [];

    let iterations = 0;
    while (run.status === "running" && iterations < MAX_STEPS_PER_TICK) {
      iterations++;

      const loc = await this.makeLocation(run, steps);
      if (loc.depth === 0 && run.currentStep >= steps.length) {
        run.status = "completed";
        run.completedAt = new Date();
        await this.runs.save(run);
        return run;
      }
      const step = loc.array[loc.index] as WorkflowStep | undefined;
      if (!step) {
        await this.completeLevelFrames(run, loc.frames, steps);
        if (loc.depth === 0 && run.currentStep >= steps.length) {
          run.status = "completed";
          run.completedAt = new Date();
          await this.runs.save(run);
          return run;
        }
        await this.runs.save(run);
        continue;
      }

      const outcome = await this.executeStep(run, loc, step);
      if (outcome === "parked") {
        this.syncLocation(run, loc);
        await this.runs.save(run);
        return run;
      }
      if (outcome === "failed") {
        const inner = loc.frames.length > 0 ? this.innermost(loc.frames) : null;
        if (inner && inner.onError === "skip") {
          const error = run.errorMessage ?? "step failed";
          run.errorMessage = null;
          run.status = "running";
          await this.endCurrentUnitWithSkip(run, loc.frames, error, steps);
          this.syncLocation(run, loc);
          await this.runs.save(run);
          continue;
        }
        this.syncLocation(run, loc);
        await this.runs.save(run);
        return run;
      }
      if (outcome === "enter") {
        // Handler pushed the frames and bound item vars already.
        await this.runs.save(run);
        continue;
      }
      if (outcome === "next") loc.index += 1;
      this.syncLocation(run, loc);
      if (loc.frames.length > 0) {
        await this.completeLevelFrames(run, loc.frames, steps);
      }
      await this.runs.save(run);
    }

    if (run.status === "running" && iterations >= MAX_STEPS_PER_TICK) {
      // Yield to the cron instead of leaving an orphaned `running` run.
      this.logger.warn(
        `Run ${run.id} hit the ${MAX_STEPS_PER_TICK}-step tick cap; re-parking to cron`,
      );
      run.status = "waiting";
      run.waitUntil = new Date();
      run.waitEvent = null;
      const frames = this.framesOf(run.context);
      if (frames.length > 0) {
        const inner = this.innermost(frames);
        inner.park = "retry"; // re-enter the same sub-step on cron wake
        this.setFrames(run, frames);
      } else {
        run.context = { ...(run.context ?? {}), _retryStep: run.currentStep } as any;
      }
      await this.runs.save(run);
    }
    return run;
  }

  /**
   * Step execution seam: dispatch by step.type to a handler. Handlers mutate
   * their location (jumps) and return an outcome; the engine owns cursors,
   * exhaustion bookkeeping and persistence.
   */
  private async executeStep(
    run: WorkflowRun,
    loc: StepLocation,
    step: WorkflowStep,
  ): Promise<"next" | "jump" | "parked" | "failed" | "enter"> {
    const type = String((step as any).type ?? "");
    const handler = this.stepHandlers[type];
    if (!handler) {
      run.status = "failed";
      run.errorMessage = `Unknown or unsupported step type '${type}'`;
      run.completedAt = new Date();
      return "failed";
    }
    return handler(run, loc, step as any);
  }

  private readonly stepHandlers: Record<
    string,
    (
      run: WorkflowRun,
      loc: StepLocation,
      step: any,
    ) =>
      | Promise<"next" | "jump" | "parked" | "failed" | "enter">
      | "next"
      | "jump"
      | "parked"
      | "failed"
      | "enter"
  > = {
    set: (run, _loc, step) => this.execSetStep(run, step),
    condition: (run, loc, step) => this.execConditionStep(run, loc, step),
    branch: (run, loc, step) => this.execConditionStep(run, loc, step),
    delay: (run, loc, step) => this.execDelayStep(run, loc, step),
    wait: (run, loc, step) => this.execDelayStep(run, loc, step),
    wait_for_event: (run, loc, step) => this.execWaitForEventStep(run, loc, step),
    send: (run, loc, step) => this.execSendStep(run, loc, step),
    foreach: (run, loc, step) => this.execForeachStep(run, loc, step),
    parallel: (run, loc, step) => this.execParallelStep(run, loc, step),
  };

  private execForeachStep(
    run: WorkflowRun,
    loc: StepLocation,
    step: ForeachStep,
  ): "enter" | "next" | "failed" {
    const context = (run.context ?? {}) as Record<string, unknown>;
    const items = dotGet(context, step.itemsKey);
    if (!Array.isArray(items)) {
      run.status = "failed";
      run.errorMessage = `foreach.itemsKey '${step.itemsKey}' did not resolve to an array`;
      run.completedAt = new Date();
      return "failed";
    }
    if (items.length === 0) {
      // Empty loop is a no-op; advance past the construct.
      return "next";
    }
    const frame: NestFrame = {
      kind: "foreach",
      index: loc.index,
      i: 0,
      subStep: 0,
      total: items.length,
      items: items as unknown[],
      onError: step.onError ?? "fail",
      mode: "all",
      itemsKey: step.itemsKey,
      as: step.as ?? "item",
      indexAs: step.indexAs ?? "itemIndex",
      park: null,
      retryCount: 0,
      results: [],
    } as NestFrame;
    const frames = loc.frames;
    frames.push(frame);
    run.context = {
      ...context,
      [frame.as]: items[0],
      [frame.indexAs]: 0,
      _frames: frames,
    } as any;
    return "enter";
  }

  private execParallelStep(
    run: WorkflowRun,
    loc: StepLocation,
    step: ParallelStep,
  ): "enter" | "next" | "failed" {
    const branches = Array.isArray(step.branches) ? step.branches : [];
    if (branches.length === 0) {
      // Validation should catch this; treat as a no-op rather than stall the run.
      return "next";
    }
    const frame: NestFrame = {
      kind: "parallel",
      index: loc.index,
      i: 0,
      subStep: 0,
      total: branches.length,
      items: [],
      onError: step.onError ?? "fail",
      mode: step.mode ?? "all",
      itemsKey: "",
      as: "",
      indexAs: "",
      park: null,
      retryCount: 0,
      results: [],
    } as NestFrame;
    const frames = loc.frames;
    frames.push(frame);
    run.context = { ...((run.context ?? {}) as any), _frames: frames } as any;
    return "enter";
  }

  private execSetStep(run: WorkflowRun, step: SetStep): "next" {
    const values = step.values && typeof step.values === "object" ? step.values : {};
    run.context = { ...(run.context ?? {}), ...values };
    this.clearStepRetry(run);
    return "next";
  }

  private execConditionStep(
    run: WorkflowRun,
    loc: StepLocation,
    step: ConditionStep,
  ): "next" | "jump" | "failed" {
    const cond = step.if ?? {};
    const key = typeof cond.key === "string" ? cond.key : "";
    const context = (run.context ?? {}) as Record<string, unknown>;
    const actual = key ? dotGet(context, key) : undefined;
    let match = false;
    if (Object.prototype.hasOwnProperty.call(cond, "equals")) match = actual === cond.equals;
    else if (Object.prototype.hasOwnProperty.call(cond, "notEquals"))
      match = actual !== cond.notEquals;
    else if (cond.exists === true) match = actual !== undefined && actual !== null;
    else if (cond.exists === false) match = actual === undefined || actual === null;

    const target = this.resolveStepRef(
      loc.array,
      match ? (step.then ?? step.thenStep) : (step.else ?? step.elseStep),
    );
    if (target === null) {
      run.status = "failed";
      run.errorMessage = `Step ${loc.index} references a branch target that does not exist`;
      run.completedAt = new Date();
      return "failed";
    }
    if (target === undefined) {
      this.clearStepRetry(run);
      return "next";
    }
    loc.index = target;
    this.clearStepRetry(run);
    return "jump";
  }

  /**
   * Resolves a step reference to an index within the current scope. Numbers
   * (and numeric strings from existing rows) are indices; any other string is a
   * step id. Returns undefined for "no target given" and null for "not found".
   */
  private resolveStepRef(
    steps: WorkflowStep[],
    ref: string | number | undefined,
  ): number | null | undefined {
    if (ref === undefined || ref === null) return undefined;
    if (typeof ref === "number") {
      return Number.isInteger(ref) && ref >= 0 && ref < steps.length ? ref : null;
    }
    const asNumber = Number(ref);
    if (ref.trim() !== "" && Number.isInteger(asNumber) && String(asNumber) === ref.trim()) {
      return asNumber >= 0 && asNumber < steps.length ? asNumber : null;
    }
    const index = steps.findIndex((candidate) => candidate.id === ref);
    return index >= 0 ? index : null;
  }

  private execDelayStep(run: WorkflowRun, loc: StepLocation, step: DelayStep): "parked" {
    const ms = Number(step.ms ?? step.durationMs ?? 0);
    const delay = Number.isFinite(ms) && ms > 0 ? ms : 0;
    run.status = "waiting";
    run.waitUntil = new Date(Date.now() + delay);
    run.waitEvent = null;
    const frames = this.framesOf(run.context);
    if (frames.length > 0) {
      this.innermost(frames).park = "delay";
      this.setFrames(run, frames);
      return "parked";
    }
    run.context = { ...(run.context ?? {}), _retryStep: undefined } as any;
    this.clearStepRetry(run);
    return "parked";
  }

  private execWaitForEventStep(
    run: WorkflowRun,
    loc: StepLocation,
    step: any,
  ): "parked" | "failed" {
    const event = typeof step.event === "string" ? step.event : "";
    if (!event) {
      run.status = "failed";
      run.errorMessage = "wait_for_event step requires an event name";
      run.completedAt = new Date();
      return "failed";
    }
    const timeoutMs = Number(step.timeoutMs);
    run.status = "waiting_for_event";
    run.waitEvent = event;
    run.waitUntil =
      Number.isFinite(timeoutMs) && timeoutMs > 0 ? new Date(Date.now() + timeoutMs) : null;
    const frames = this.framesOf(run.context);
    if (frames.length > 0) {
      this.innermost(frames).park = "event";
      this.setFrames(run, frames);
      return "parked";
    }
    this.clearStepRetry(run);
    return "parked";
  }

  private async execSendStep(
    run: WorkflowRun,
    loc: StepLocation,
    step: SendStep,
  ): Promise<"next" | "parked" | "failed"> {
    try {
      const context = (run.context ?? {}) as Record<string, unknown>;
      const to = this.resolveString(step.to, context);
      const channelsRaw = Array.isArray(step.channels) ? step.channels : [];
      const channels = channelsRaw.filter((ch): ch is NotificationChannel => CHANNELS.has(ch));
      if (!to || channels.length === 0) {
        run.status = "failed";
        run.errorMessage = "send step requires 'to' and at least one valid channel";
        run.completedAt = new Date();
        return "failed";
      }
      const templateId =
        typeof step.templateId === "string" && step.templateId.trim()
          ? step.templateId.trim()
          : undefined;
      const body = this.resolveString(step.data ?? "", context) || undefined;
      const subject = this.resolveString(step.subject ?? "", context) || undefined;
      if (!templateId && !body) {
        run.status = "failed";
        run.errorMessage = "send step requires templateId or data (the raw body)";
        run.completedAt = new Date();
        return "failed";
      }
      const stepVariables =
        step.variables && typeof step.variables === "object" ? step.variables : {};
      await this.unifiedSendService.send(
        {
          to,
          channels,
          templateId,
          data: body,
          subject,
          variables: {
            ...publicContext(context),
            ...stepVariables,
            workflowRunId: run.id,
          },
          metadata: { workflowRunId: run.id, workflowId: run.workflowId, source: "workflow" },
        },
        run.tenantId,
      );
      const frames = this.framesOf(run.context);
      if (frames.length > 0) {
        this.innermost(frames).retryCount = 0;
        this.setFrames(run, frames);
        return "next";
      }
      this.clearStepRetry(run);
      return "next";
    } catch (error) {
      const retry = this.maybeRetryStep(run, loc, step, error as Error);
      if (retry === "parked") return "parked";
      run.status = "failed";
      run.errorMessage = `send step failed: ${(error as Error).message}`;
      run.completedAt = new Date();
      return "failed";
    }
  }

  private clearStepRetry(run: WorkflowRun): void {
    if (
      (run.context as any)?._stepRetryCount !== undefined ||
      (run.context as any)?._retryStep !== undefined
    ) {
      const { _stepRetryCount, _retryStep, ...rest } = (run.context ?? {}) as any;
      run.context = rest;
    }
  }

  private maybeRetryStep(
    run: WorkflowRun,
    loc: StepLocation,
    step: SendStep,
    _error: Error,
  ): "parked" | "failed" {
    const retry = step.retry ?? {};
    const attempts = Number(retry.attempts ?? 0);
    const delayMs = Number(retry.delayMs ?? 5000);
    if (!Number.isFinite(attempts) || attempts <= 0) return "failed";

    const frames = this.framesOf(run.context);
    if (frames.length > 0) {
      const inner = this.innermost(frames);
      const count = inner.retryCount ?? 0;
      if (count >= Math.floor(attempts)) return "failed";
      inner.retryCount = count + 1;
      inner.park = "retry";
      run.status = "waiting";
      run.waitUntil = new Date(
        Date.now() + (Number.isFinite(delayMs) && delayMs > 0 ? delayMs : 5000),
      );
      run.waitEvent = null;
      this.setFrames(run, frames);
      return "parked";
    }

    const count = Number((run.context as any)?._stepRetryCount ?? 0);
    if (count >= Math.floor(attempts)) return "failed";
    run.context = {
      ...(run.context ?? {}),
      _stepRetryCount: count + 1,
      _retryStep: run.currentStep,
    } as any;
    run.status = "waiting";
    run.waitUntil = new Date(
      Date.now() + (Number.isFinite(delayMs) && delayMs > 0 ? delayMs : 5000),
    );
    run.waitEvent = null;
    return "parked";
  }

  /** Resolves `{{dot.path}}` placeholders from run context for simple string fields. */
  private resolveString(value: unknown, context: Record<string, unknown>): string {
    if (typeof value !== "string") {
      return "";
    }
    return value.replace(/\{\{\s*([a-zA-Z0-9_.\-]+)\s*\}\}/g, (_m, key: string) => {
      const v = dotGet(context, key);
      return v === undefined || v === null ? "" : String(v);
    });
  }
}
