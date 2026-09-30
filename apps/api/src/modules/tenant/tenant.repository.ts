import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { BaseRepository } from "../../database/repositories/base.repository";
import { Like, Repository } from "typeorm";
import { Tenant } from "./entities/tenant.entity";

@Injectable()
export class TenantRepository extends BaseRepository<Tenant> {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {
    super(tenantRepository);
  }

  async findSlugsStartingWith(baseSlug: string): Promise<string[]> {
    const tenants = await this.tenantRepository.find({
      where: { subdomain: Like(`${baseSlug}%`) },
      select: ["subdomain"], // Only fetch the `subdomain` field
    });

    return tenants.map((tenant: Tenant) => tenant.subdomain);
  }
}
