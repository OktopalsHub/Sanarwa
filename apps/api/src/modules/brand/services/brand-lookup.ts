import { NotFoundException } from "@nestjs/common";
import { BaseRepository } from "../../../database/repositories/base.repository";
import { Brand } from "../entities/brand.entity";

export async function getBrandOrThrow(
  brandRepository: BaseRepository<Brand>,
  tenantId: string,
  id: string,
): Promise<Brand> {
  const brand = await brandRepository.findById(id, false, { tenant: { id: tenantId } });

  if (!brand) {
    throw new NotFoundException(`Brand with ID ${id} not found`);
  }

  return brand;
}
