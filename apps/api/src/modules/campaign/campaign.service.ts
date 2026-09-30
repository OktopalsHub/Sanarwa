import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Campaign } from "./entities/campaign.entity";
import { CreateCampaignDto } from "./dto/create-campaign.dto";
import { UpdateCampaignDto } from "./dto/update-campaign.dto";
import { CampaignQueryDto } from "./dto/campaign-query.dto";

const defaultAnalytics = {
  totalSent: 0,
  totalDelivered: 0,
  totalOpened: 0,
  totalClicked: 0,
  totalConverted: 0,
  deliveryRate: 0,
  openRate: 0,
  clickRate: 0,
  conversionRate: 0,
  channelBreakdown: [],
  lastUpdated: new Date(),
};

@Injectable()
export class CampaignService {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
  ) {}

  async create(tenantId: string, dto: CreateCampaignDto, createdById?: string): Promise<Campaign> {
    const campaign = this.campaignRepository.create({
      tenantId,
      name: dto.name,
      description: dto.description,
      type: dto.type || "one_time",
      status: dto.status || "draft",
      channels: dto.channels || [],
      audience: dto.audience || { type: "all" },
      schedule: dto.schedule || { type: "immediate" },
      templates: dto.templates || [],
      analytics: defaultAnalytics,
      createdById,
    });
    return this.campaignRepository.save(campaign);
  }

  async findAll(tenantId: string, query: CampaignQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const qb = this.campaignRepository
      .createQueryBuilder("campaign")
      .where("campaign.tenant_id = :tenantId", { tenantId });

    if (query.status) {
      qb.andWhere("campaign.status = :status", { status: query.status });
    }
    if (query.search) {
      qb.andWhere("(campaign.name ILIKE :search OR campaign.description ILIKE :search)", {
        search: `%${query.search}%`,
      });
    }

    const sortBy = query.sortBy || "createdAt";
    const sortOrder = (query.sortOrder || "desc").toUpperCase() as "ASC" | "DESC";
    qb.orderBy(`campaign.${sortBy}`, sortOrder);

    qb.skip((page - 1) * limit).take(limit);
    const [campaigns, total] = await qb.getManyAndCount();

    return {
      campaigns: campaigns.map((c) => this.toResponse(c)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(tenantId: string, id: string): Promise<Campaign> {
    const campaign = await this.campaignRepository.findOne({
      where: { id, tenantId },
    });
    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }
    return campaign;
  }

  async update(tenantId: string, id: string, dto: UpdateCampaignDto): Promise<Campaign> {
    const campaign = await this.findOne(tenantId, id);
    Object.assign(campaign, dto);
    return this.campaignRepository.save(campaign);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const campaign = await this.findOne(tenantId, id);
    await this.campaignRepository.remove(campaign);
  }

  private toResponse(campaign: Campaign) {
    return {
      id: campaign.id,
      tenantId: campaign.tenantId,
      name: campaign.name,
      description: campaign.description,
      type: campaign.type,
      status: campaign.status,
      channels: campaign.channels,
      audience: campaign.audience,
      schedule: campaign.schedule,
      templates: campaign.templates,
      analytics: campaign.analytics,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      createdBy: campaign.createdById || "",
    };
  }
}
