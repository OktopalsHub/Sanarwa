import { randomUUID } from "node:crypto";
import { FindOptionsWhere, IsNull } from "typeorm";
import { Template } from "../template.entity";
import {
  BusinessLogicException,
  ValidationException,
} from "../../../common/errors/exceptions/base.exception";
import { slugify } from "../../../common/utils/slugify";
import { ErrorCode } from "../../../common/errors/types/error.types";

export interface TemplateSlugRepo {
  findOne(options: { where: FindOptionsWhere<Template> }): Promise<Template | null>;
}

export async function uniqueTemplateSlug(
  repo: TemplateSlugRepo,
  tenantId: string,
  projectId: string | undefined,
  rawName: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(rawName);

  if (base.length === 0) {
    throw new ValidationException(
      "Template name must contain at least one letter or digit",
      { correlationId: randomUUID(), tenantId, timestamp: new Date(), metadata: { rawName } },
      "Template name must contain at least one letter or digit",
    );
  }

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const existing = await repo.findOne({
      where: projectId
        ? { tenantId, projectId, name: candidate }
        : { tenantId, projectId: IsNull(), name: candidate },
    });

    if (!existing || existing.id === excludeId) {
      return candidate;
    }
  }

  throw new BusinessLogicException(
    ErrorCode.DUPLICATE_RESOURCE,
    `Could not allocate a unique slug for template name "${rawName}"`,
    { correlationId: randomUUID(), tenantId, timestamp: new Date(), metadata: { rawName } },
    "Could not allocate a unique template name; choose a different one",
    false,
  );
}
