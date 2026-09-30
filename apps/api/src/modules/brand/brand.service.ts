import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { getPaginationSummary } from "../../common/dto/pagination.dto";
import { IPaginatedData } from "../../common/interfaces";
import { BaseRepository } from "../../database/repositories/base.repository";
import { BRAND_REPO } from "./brand.tokens";
import { CreateBrandDto } from "./dtos/create-brand.dto";
import { UpdateBrandDto } from "./dtos/update-brand.dto";
import { Brand } from "./entities/brand.entity";

@Injectable()
export class BrandService {
  constructor(
    @Inject(BRAND_REPO)
    private readonly brandRepository: BaseRepository<Brand>,
  ) {}

  async createBrand(
    tenantId: string,
    createDto: CreateBrandDto,
    createdById: string,
  ): Promise<Brand> {
    return this.brandRepository.create({
      ...createDto,
      tenant: {
        id: tenantId,
      },
      ...(createdById && { createdBy: { id: createdById } }),
    });
  }

  async getBrands(tenantId: string, query?: any): Promise<IPaginatedData<Partial<Brand>>> {
    const page = query?.page || 1;
    const limit = query?.limit || 10;

    const queryBuilder = this.brandRepository
      .createQueryBuilder("brand")
      .select([
        "brand.id",
        "brand.name",
        "brand.description",
        "brand.domain",
        "brand.status",
        "brand.logo",
        "brand.primaryColor",
        "brand.secondaryColor",
        "brand.defaultFromEmail",
        "brand.defaultFromName",
      ])
      .where("brand.tenantId = :tenantId", { tenantId });

    // Apply filters
    if (query?.search) {
      queryBuilder.andWhere("(brand.name ILIKE :search OR brand.description ILIKE :search)", {
        search: `%${query.search}%`,
      });
    }

    if (query?.status) {
      queryBuilder.andWhere("brand.status = :status", { status: query.status });
    }

    // Apply sorting
    const sortField = query?.sortBy || "createdAt";
    const sortOrder = query?.sortOrder || "DESC";
    queryBuilder.orderBy(`brand.${sortField}`, sortOrder);

    // Apply pagination
    queryBuilder.skip((page - 1) * limit).take(limit);

    const [brands, total] = await queryBuilder.getManyAndCount();

    // Transform to only include necessary fields
    const sanitizedBrands = brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      description: brand.description,
      domain: brand.domain,
      status: brand.status,
      logo: brand.logo,
      primaryColor: brand.primaryColor,
      secondaryColor: brand.secondaryColor,
      defaultFromEmail: brand.defaultFromEmail,
      defaultFromName: brand.defaultFromName,
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
    }));

    return getPaginationSummary(sanitizedBrands, total, { page, limit }, "brands");
  }

  async getBrandById(tenantId: string, id: string): Promise<Brand> {
    const brand = await this.brandRepository.findById(id, false, { tenant: { id: tenantId } });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    return brand;
  }

  async updateBrand(tenantId: string, id: string, updateDto: UpdateBrandDto): Promise<Brand> {
    await this.getBrandById(tenantId, id); // Verify exists

    const updated = await this.brandRepository.update(id, updateDto);
    if (!updated) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    return updated;
  }

  async removeBrand(tenantId: string, id: string): Promise<void> {
    await this.getBrandById(tenantId, id); // Verify exists
    await this.brandRepository.delete(id);
  }
}
