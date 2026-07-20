import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ComplianceService } from './compliance.service';

@ApiTags('Compliance')
@ApiBearerAuth()
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) { }

  /**
   * GDPR Data Portability - Export user data
   */
  @Get('data-export/:userId')
  @ApiOperation({ summary: 'Export user data (GDPR)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User data export initiated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async exportUserData(
    @Param('userId') userId: string,
    @Query('tenantId') tenantId: string,
    @Query('includePersonalData') includePersonalData?: string,
    @Query('includeCommunicationHistory') includeCommunicationHistory?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const request = {
      userId,
      tenantId,
      includePersonalData: includePersonalData === 'true',
      includeCommunicationHistory: includeCommunicationHistory === 'true',
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    };

    return this.complianceService.exportUserData(request);
  }

  /**
   * GDPR Right to Erasure - Delete user data
   */
  @Delete('data-erasure/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Erasure of user data (GDPR)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User data erasure initiated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUserData(
    @Param('userId') userId: string,
    @Query('tenantId') tenantId: string,
    @Query('reason') reason?: 'user_request' | 'retention_expired' | 'legal_requirement',
    @Query('requestedBy') requestedBy?: string,
  ) {
    const request = {
      userId,
      tenantId,
      reason: reason || 'user_request',
      requestedBy: requestedBy || 'system',
    };

    return this.complianceService.deleteUserData(request);
  }

  /**
   * Automated data retention cleanup
   */
  @Post('retention-cleanup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger retention cleanup' })
  @ApiResponse({ status: 200, description: 'Retention cleanup initiated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async performRetentionCleanup(@Query('tenantId') tenantId?: string) {
    return this.complianceService.performRetentionCleanup(tenantId);
  }

  /**
   * Record user consent
   */
  @Post('consent')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record user consent' })
  @ApiResponse({ status: 201, description: 'Consent recorded successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async recordConsent(@Body() consentData: {
    userId: string;
    tenantId: string;
    consentType: 'marketing' | 'analytics' | 'third_party_sharing';
    consented: boolean;
    source: string;
    expiryDate?: string;
    metadata?: Record<string, any>;
  }) {
    const consent = {
      ...consentData,
      consentDate: new Date(),
      expiryDate: consentData.expiryDate ? new Date(consentData.expiryDate) : undefined,
    };

    return this.complianceService.recordConsent(consent);
  }

  /**
   * Revoke user consent
   */
  @Delete('consent/:userId/:consentType')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke user consent' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'consentType', description: 'Type of consent to revoke' })
  @ApiResponse({ status: 200, description: 'Consent revoked successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Consent record not found' })
  async revokeConsent(
    @Param('userId') userId: string,
    @Param('consentType') consentType: string,
    @Query('tenantId') tenantId: string,
  ) {
    return this.complianceService.revokeConsent(userId, tenantId, consentType);
  }

  /**
   * Get user consent records
   */
  @Get('consent/:userId')
  @ApiOperation({ summary: 'Get user consent records' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Consent records retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserConsentRecords(
    @Param('userId') userId: string,
    @Query('tenantId') tenantId: string,
  ) {
    return this.complianceService.getUserConsentRecords(userId, tenantId);
  }

  /**
   * Update communication preferences
   */
  @Post('preferences/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update communication preferences' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Preferences updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateCommunicationPreferences(
    @Param('userId') userId: string,
    @Query('tenantId') tenantId: string,
    @Body() preferences: {
      emailMarketing?: boolean;
      smsMarketing?: boolean;
      pushNotifications?: boolean;
      frequency?: 'daily' | 'weekly' | 'monthly' | 'never';
    },
  ) {
    return this.complianceService.updateCommunicationPreferences(userId, tenantId, preferences);
  }

  /**
   * Get user communication preferences
   */
  @Get('preferences/:userId')
  @ApiOperation({ summary: 'Get user communication preferences' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Preferences retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserCommunicationPreferences(
    @Param('userId') userId: string,
    @Query('tenantId') tenantId: string,
  ) {
    return this.complianceService.getUserCommunicationPreferences(userId, tenantId);
  }

  /**
   * Get privacy audit trail
   */
  @Get('audit-trail/:userId')
  @ApiOperation({ summary: 'Get privacy audit trail' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Audit trail retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPrivacyAuditTrail(
    @Param('userId') userId: string,
    @Query('tenantId') tenantId: string,
  ) {
    return this.complianceService.getPrivacyAuditTrail(userId, tenantId);
  }
}