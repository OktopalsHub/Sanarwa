import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISMSProvider, SMSPayload, SMSResponse, BulkSMSPayload, BulkSMSResponse } from '../sms-provider.interface';

// Import AfricasTalking SDK
const AfricasTalking = require('africastalking');

@Injectable()
export class AfricasTalkingProvider implements ISMSProvider {
  private readonly logger = new Logger(AfricasTalkingProvider.name);
  private readonly apiKey: string;
  private readonly username: string;
  private readonly shortCode: string;
  private readonly africasTalking: any;
  private readonly sms: any;

  // AfricasTalking pricing per country (approximate, in USD)
  private readonly countryPricing: Record<string, number> = {
    'KE': 0.008,  // Kenya
    'UG': 0.012,  // Uganda
    'TZ': 0.015,  // Tanzania
    'RW': 0.018,  // Rwanda
    'NG': 0.020,  // Nigeria
    'GH': 0.025,  // Ghana
    'ZA': 0.030,  // South Africa
    'MW': 0.015,  // Malawi
    'ZM': 0.020,  // Zambia
    'BW': 0.025,  // Botswana
    'ET': 0.020,  // Ethiopia
    'SN': 0.030,  // Senegal
    'CI': 0.030,  // Ivory Coast
    'BF': 0.035,  // Burkina Faso
    'ML': 0.035,  // Mali
    'NE': 0.035,  // Niger
    'TD': 0.040,  // Chad
    'CM': 0.025,  // Cameroon
    'GA': 0.035,  // Gabon
    'CG': 0.040,  // Congo
    'CD': 0.040,  // Democratic Republic of Congo
    'CF': 0.045,  // Central African Republic
    'AO': 0.035,  // Angola
    'MZ': 0.030,  // Mozambique
    'MG': 0.035,  // Madagascar
    'MU': 0.025,  // Mauritius
    'SC': 0.040,  // Seychelles
    'DJ': 0.040,  // Djibouti
    'SO': 0.045,  // Somalia
    'SS': 0.050,  // South Sudan
    'SD': 0.045,  // Sudan
    'EG': 0.030,  // Egypt
    'LY': 0.040,  // Libya
    'TN': 0.035,  // Tunisia
    'DZ': 0.035,  // Algeria
    'MA': 0.030,  // Morocco
    '*': 0.040,   // Default for other countries
  };

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get('AFRICASTALKING_API_KEY') || '';
    this.username = this.configService.get('AFRICASTALKING_USERNAME') || '';
    this.shortCode = this.configService.get('AFRICASTALKING_SHORT_CODE') || '';

    // Initialize AfricasTalking SDK
    if (this.apiKey && this.username) {
      try {
        this.africasTalking = AfricasTalking({
          apiKey: this.apiKey,
          username: this.username,
        });
        this.sms = this.africasTalking.SMS;
        this.logger.log('AfricasTalking SDK initialized successfully');
      } catch (error) {
        this.logger.error('Failed to initialize AfricasTalking SDK:', error.message);
      }
    }
  }

  async sendSMS(payload: SMSPayload): Promise<SMSResponse> {
    try {
      if (!this.sms) {
        throw new Error('AfricasTalking SDK not initialized. Check your API key and username.');
      }

      // Sender ID priority: payload.from > shortCode > username
      const senderId = payload.from || this.shortCode || this.username;

      const options = {
        to: [payload.to], // AfricasTalking expects an array
        message: payload.message,
        from: senderId,
      };

      this.logger.log(`Sending SMS via AfricasTalking to ${payload.to} from ${senderId}`);

      const result = await this.sms.send(options);

      // AfricasTalking returns response with SMSMessageData
      const recipients = result.SMSMessageData?.Recipients || [];

      if (recipients.length === 0) {
        throw new Error('No recipient data returned from AfricasTalking');
      }

      const recipient = recipients[0];

      if (recipient.status !== 'Success') {
        throw new Error(`Message failed: ${recipient.status} - ${recipient.statusCode}`);
      }

      this.logger.log(`SMS sent successfully via AfricasTalking: ${recipient.messageId}`);

      // Parse cost from the response
      const cost = this.parseCost(recipient.cost) || this.getCostPerMessage(this.extractCountryCode(payload.to));

      return {
        success: true,
        messageId: recipient.messageId,
        cost: cost,
        provider: 'africastalking',
      };
    } catch (error) {
      this.logger.error(`Failed to send SMS via AfricasTalking: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        provider: 'africastalking',
      };
    }
  }

  async sendBulkSMS(payload: BulkSMSPayload): Promise<BulkSMSResponse> {
    try {
      if (!this.sms) {
        throw new Error('AfricasTalking SDK not initialized. Check your API key and username.');
      }

      const senderId = payload.from || this.shortCode || this.username;

      const options = {
        to: payload.recipients, // AfricasTalking supports bulk SMS natively
        message: payload.message,
        from: senderId,
      };

      this.logger.log(`Sending bulk SMS via AfricasTalking to ${payload.recipients.length} recipients from ${senderId}`);

      const result = await this.sms.send(options);

      // Process results for each recipient
      const recipients = result.SMSMessageData?.Recipients || [];
      const results: BulkSMSResponse['results'] = [];
      let totalCost = 0;

      // Map results to recipients
      payload.recipients.forEach((recipient, index) => {
        const recipientResult = recipients.find(r => r.number === recipient) || recipients[index];

        if (recipientResult) {
          const isSuccess = recipientResult.status === 'Success';
          const cost = isSuccess ? (this.parseCost(recipientResult.cost) || this.getCostPerMessage(this.extractCountryCode(recipient))) : 0;

          results.push({
            recipient,
            messageId: recipientResult.messageId,
            success: isSuccess,
            error: isSuccess ? undefined : `${recipientResult.status} - ${recipientResult.statusCode}`,
          });

          if (isSuccess) {
            totalCost += cost;
          }
        } else {
          // No result found for this recipient
          results.push({
            recipient,
            success: false,
            error: 'No response data for this recipient',
          });
        }
      });

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      this.logger.log(`Bulk SMS sent via AfricasTalking: ${successCount} success, ${failureCount} failed`);

      return {
        success: successCount > 0,
        results,
        totalCost,
        successCount,
        failureCount,
        provider: 'africastalking',
      };
    } catch (error) {
      this.logger.error(`Failed to send bulk SMS via AfricasTalking: ${error.message}`, error.stack);

      // Mark all as failed
      const results = payload.recipients.map(recipient => ({
        recipient,
        success: false,
        error: error.message,
      }));

      return {
        success: false,
        results,
        totalCost: 0,
        successCount: 0,
        failureCount: payload.recipients.length,
        provider: 'africastalking',
      };
    }
  }

  async validateConfig(): Promise<boolean> {
    return !!(this.apiKey && this.username && this.sms);
  }

  getProviderName(): string {
    return 'africastalking';
  }

  getSupportedCountries(): string[] {
    return Object.keys(this.countryPricing);
  }

  getCostPerMessage(countryCode: string): number {
    return this.countryPricing[countryCode] || this.countryPricing['*'];
  }

  /**
   * Parse cost from AfricasTalking response
   * Cost comes in format like "KES 1.0000" or "USD 0.05"
   */
  private parseCost(costString: string): number {
    if (!costString) return 0;

    try {
      // Extract numeric value from cost string
      const match = costString.match(/[\d.]+/);
      if (match) {
        const amount = parseFloat(match[0]);

        // Convert to USD if needed (rough conversion)
        if (costString.includes('KES')) {
          return amount * 0.0067; // 1 KES ≈ 0.0067 USD
        } else if (costString.includes('NGN')) {
          return amount * 0.0013; // 1 NGN ≈ 0.0013 USD
        } else if (costString.includes('GHS')) {
          return amount * 0.084; // 1 GHS ≈ 0.084 USD
        } else if (costString.includes('ZAR')) {
          return amount * 0.055; // 1 ZAR ≈ 0.055 USD
        } else {
          // Assume USD or return as-is
          return amount;
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to parse cost: ${costString}`, error.message);
    }

    return 0;
  }

  /**
   * Extract country code from phone number for cost calculation
   */
  private extractCountryCode(phoneNumber: string): string {
    if (phoneNumber.startsWith('+254')) return 'KE'; // Kenya
    if (phoneNumber.startsWith('+234')) return 'NG'; // Nigeria
    if (phoneNumber.startsWith('+233')) return 'GH'; // Ghana
    if (phoneNumber.startsWith('+27')) return 'ZA';  // South Africa
    if (phoneNumber.startsWith('+256')) return 'UG'; // Uganda
    if (phoneNumber.startsWith('+255')) return 'TZ'; // Tanzania
    if (phoneNumber.startsWith('+250')) return 'RW'; // Rwanda
    if (phoneNumber.startsWith('+251')) return 'ET'; // Ethiopia
    if (phoneNumber.startsWith('+221')) return 'SN'; // Senegal
    if (phoneNumber.startsWith('+225')) return 'CI'; // Ivory Coast
    if (phoneNumber.startsWith('+226')) return 'BF'; // Burkina Faso
    if (phoneNumber.startsWith('+223')) return 'ML'; // Mali
    if (phoneNumber.startsWith('+229')) return 'BJ'; // Benin
    if (phoneNumber.startsWith('+228')) return 'TG'; // Togo
    return '*'; // Default
  }
}