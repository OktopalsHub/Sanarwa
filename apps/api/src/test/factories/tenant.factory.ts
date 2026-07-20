// import {
//   Tenant,
//   TenantStatus,
// } from '../../modules/tenant/entities/tenant.entity';

// export class TenantFactory {
//   static create(overrides: Partial<Tenant> = {}): Tenant {
//     const defaultTenant: Partial<Tenant> = {
//       id: 'tenant-' + Math.random().toString(36).substring(2, 11),
//       name: 'Test Tenant',
//       description: 'Test tenant description',
//       subdomain: 'test-tenant-' + Math.random().toString(36).substring(2, 8),
//       apiKey: 'nf_' + Math.random().toString(36).substring(2, 34),
//       apiSecret:
//         'encrypted_secret_' + Math.random().toString(36).substring(2, 34),
//       status: TenantStatus.ACTIVE,
//       quotas: {
//         notifications: { daily: 1000, monthly: 30000 },
//         channels: {
//           email: { daily: 500, monthly: 15000 },
//           sms: { daily: 200, monthly: 6000 },
//           push: { daily: 300, monthly: 9000 },
//           whatsapp: { daily: 100, monthly: 3000 },
//         },
//       },
//       settings: {
//         timezone: 'UTC',
//         defaultFromEmail: 'noreply@test.com',
//         webhookUrl: 'https://example.com/webhook',
//       },
//       usage: {
//         currentMonth: {
//           notifications: 0,
//           email: 0,
//           sms: 0,
//           push: 0,
//           whatsapp: 0,
//         },
//         lastUpdated: new Date(),
//       },
//       lastActiveAt: new Date(),
//       createdAt: new Date(),
//       updatedAt: new Date(),
//     };

//     return { ...defaultTenant, ...overrides } as Tenant;
//   }

//   static createMany(count: number, overrides: Partial<Tenant> = {}): Tenant[] {
//     return Array.from({ length: count }, (_, index) =>
//       this.create({
//         ...overrides,
//         id: `tenant-${index + 1}`,
//         name: `Test Tenant ${index + 1}`,
//         subdomain: `test-tenant-${index + 1}`,
//         apiKey: `nf_test_key_${index + 1}`,
//       }),
//     );
//   }

//   static createWithStatus(
//     status: TenantStatus,
//     overrides: Partial<Tenant> = {},
//   ): Tenant {
//     return this.create({ ...overrides, status });
//   }

//   static createWithUsage(
//     usage: Partial<NonNullable<Tenant['usage']>['currentMonth']>,
//     overrides: Partial<Tenant> = {},
//   ): Tenant {
//     return this.create({
//       ...overrides,
//       usage: {
//         currentMonth: {
//           notifications: 0,
//           email: 0,
//           sms: 0,
//           push: 0,
//           whatsapp: 0,
//           ...usage,
//         },
//         lastUpdated: new Date(),
//       },
//     });
//   }

//   static createWithQuotas(
//     quotas: Partial<Tenant['quotas']>,
//     overrides: Partial<Tenant> = {},
//   ): Tenant {
//     return this.create({
//       ...overrides,
//       quotas: {
//         notifications: { daily: 1000, monthly: 30000 },
//         channels: {
//           email: { daily: 500, monthly: 15000 },
//           sms: { daily: 200, monthly: 6000 },
//           push: { daily: 300, monthly: 9000 },
//           whatsapp: { daily: 100, monthly: 3000 },
//         },
//         ...quotas,
//       },
//     });
//   }

//   static createSanitized(
//     overrides: Partial<Tenant> = {},
//   ): Omit<Tenant, 'apiSecret'> {
//     const tenant = this.create(overrides);
//     const { apiSecret, ...sanitized } = tenant;
//     return sanitized;
//   }
// }
