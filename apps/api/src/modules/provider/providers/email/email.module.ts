import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MailgunProvider } from "./providers/mailgun.provider";
import { SendGridProvider } from "./providers/sendgrid.provider";
import { SESProvider } from "./providers/ses.provider";
import { EmailProviderConfig } from "./email-provider.interface";

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MailgunProvider,
      useFactory: (configService: ConfigService) => {
        const config: EmailProviderConfig = {
          providerId: "mailgun",
          name: "Mailgun",
          isActive: configService.get<boolean>("MAILGUN_ENABLED", false),
          priority: configService.get<number>("MAILGUN_PRIORITY", 1),
          config: {
            apiKey: configService.get<string>("MAILGUN_API_KEY", ""),
            domain: configService.get<string>("MAILGUN_DOMAIN", ""),
            region: configService.get<string>("MAILGUN_REGION", "us"),
            fromEmail: configService.get<string>("MAILGUN_FROM_EMAIL", ""),
            fromName: configService.get<string>("MAILGUN_FROM_NAME", ""),
            testMode: configService.get<boolean>("MAILGUN_TEST_MODE", false),
          },
          rateLimits: {
            perSecond: configService.get<number>("MAILGUN_RATE_LIMIT_PER_SECOND", 10),
            perMinute: configService.get<number>("MAILGUN_RATE_LIMIT_PER_MINUTE", 300),
            perHour: configService.get<number>("MAILGUN_RATE_LIMIT_PER_HOUR", 10000),
          },
          failoverConfig: {
            maxRetries: 3,
            retryDelay: 1000,
          },
        };
        return new MailgunProvider(config);
      },
      inject: [ConfigService],
    },
    {
      provide: SendGridProvider,
      useFactory: (configService: ConfigService) => {
        const config: EmailProviderConfig = {
          providerId: "sendgrid",
          name: "SendGrid",
          isActive: configService.get<boolean>("SENDGRID_ENABLED", false),
          priority: configService.get<number>("SENDGRID_PRIORITY", 2),
          config: {
            apiKey: configService.get<string>("SENDGRID_API_KEY", ""),
            fromEmail: configService.get<string>("SENDGRID_FROM_EMAIL", ""),
            fromName: configService.get<string>("SENDGRID_FROM_NAME", ""),
            sandboxMode: configService.get<boolean>("SENDGRID_SANDBOX_MODE", false),
          },
          rateLimits: {
            perSecond: configService.get<number>("SENDGRID_RATE_LIMIT_PER_SECOND", 10),
            perMinute: configService.get<number>("SENDGRID_RATE_LIMIT_PER_MINUTE", 600),
            perHour: configService.get<number>("SENDGRID_RATE_LIMIT_PER_HOUR", 20000),
          },
          failoverConfig: {
            maxRetries: 3,
            retryDelay: 1000,
          },
        };
        return new SendGridProvider(config);
      },
      inject: [ConfigService],
    },
    {
      provide: SESProvider,
      useFactory: (configService: ConfigService) => {
        const config: EmailProviderConfig = {
          providerId: "ses",
          name: "Amazon SES",
          isActive: configService.get<boolean>("AWS_SES_ENABLED", false),
          priority: configService.get<number>("AWS_SES_PRIORITY", 3),
          config: {
            region: configService.get<string>("AWS_SES_REGION", "us-east-1"),
            accessKeyId: configService.get<string>("AWS_ACCESS_KEY_ID", ""),
            secretAccessKey: configService.get<string>("AWS_SECRET_ACCESS_KEY", ""),
            fromEmail: configService.get<string>("AWS_SES_FROM_EMAIL", ""),
            fromName: configService.get<string>("AWS_SES_FROM_NAME", ""),
            configurationSet: configService.get<string>("AWS_SES_CONFIGURATION_SET", ""),
          },
          rateLimits: {
            perSecond: configService.get<number>("AWS_SES_RATE_LIMIT_PER_SECOND", 14),
            perMinute: configService.get<number>("AWS_SES_RATE_LIMIT_PER_MINUTE", 200),
            perHour: configService.get<number>("AWS_SES_RATE_LIMIT_PER_HOUR", 10000),
          },
          failoverConfig: {
            maxRetries: 3,
            retryDelay: 1000,
          },
        };
        return new SESProvider(config);
      },
      inject: [ConfigService],
    },
  ],
  exports: [MailgunProvider, SendGridProvider, SESProvider],
})
export class EmailModule {}
