import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TenantCreatedEvent } from "../../../common/events/tenant.event";
import { WELCOME_SIGNUP_TOKENS } from "../constants/token-pricing";
import { TokenTransaction, TokenTransactionType } from "../entities/token-balance.entity";
import { TokenManagementService } from "../../token-management/services/token-management.service";

const WELCOME_REFERENCE = "welcome-signup";

@Injectable()
export class WelcomeTokenListener {
  private readonly logger = new Logger(WelcomeTokenListener.name);

  constructor(
    private readonly tokenManagementService: TokenManagementService,
    @InjectRepository(TokenTransaction)
    private readonly tokenTransactionRepository: Repository<TokenTransaction>,
  ) {}

  @OnEvent("tenant.created")
  async handleTenantCreated(event: TenantCreatedEvent): Promise<void> {
    const tenantId = event.tenant.id;

    try {
      const existing = await this.tokenTransactionRepository.findOne({
        where: { tenantId, referenceId: WELCOME_REFERENCE },
      });

      if (existing) {
        return;
      }

      await this.tokenManagementService.addTokens(
        tenantId,
        WELCOME_SIGNUP_TOKENS,
        TokenTransactionType.BONUS,
        "Welcome bonus — 3,000 tokens",
        { source: "signup" },
        WELCOME_REFERENCE,
      );

      this.logger.log(`Granted ${WELCOME_SIGNUP_TOKENS} welcome tokens to tenant ${tenantId}`);
    } catch (error) {
      this.logger.error(`Failed to grant welcome tokens for tenant ${tenantId}`, error);
    }
  }
}
