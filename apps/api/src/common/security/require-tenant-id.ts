import { BadRequestException } from "@nestjs/common";
import { isUUID } from "class-validator";

export function requireTenantId(value: unknown): string {
  if (typeof value !== "string" || !isUUID(value)) {
    throw new BadRequestException("tenantId query parameter must be a valid UUID");
  }
  return value;
}
