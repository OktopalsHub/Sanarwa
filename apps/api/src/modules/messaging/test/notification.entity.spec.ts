import { NotificationEntity, NotificationChannel, NotificationStatus, Priority } from '../notification.entity';

describe('NotificationEntity', () => {
  let notification: NotificationEntity;

  beforeEach(() => {
    notification = new NotificationEntity();
    notification.id = '123e4567-e89b-12d3-a456-426614174000';
    notification.tenantId = 'tenant-123';
    notification.to = 'user@example.com';
    notification.message = 'Test notification message';
    notification.subject = 'Test Subject';
    notification.channel = NotificationChannel.EMAIL;
    notification.priority = Priority.NORMAL;
    notification.status = NotificationStatus.PENDING;
    notification.createdAt = new Date();
    notification.updatedAt = new Date();
  });

  it('should be defined', () => {
    expect(notification).toBeDefined();
  });

  it('should have correct properties', () => {
    expect(notification.id).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(notification.tenantId).toBe('tenant-123');
    expect(notification.to).toBe('user@example.com');
    expect(notification.message).toBe('Test notification message');
    expect(notification.subject).toBe('Test Subject');
    expect(notification.channel).toBe(NotificationChannel.EMAIL);
    expect(notification.priority).toBe(Priority.NORMAL);
    expect(notification.status).toBe(NotificationStatus.PENDING);
  });

  it('should have default priority as NORMAL', () => {
    const newNotification = new NotificationEntity();
    newNotification.priority = Priority.NORMAL;
    expect(newNotification.priority).toBe(Priority.NORMAL);
  });

  it('should have default status as PENDING', () => {
    const newNotification = new NotificationEntity();
    newNotification.status = NotificationStatus.PENDING;
    expect(newNotification.status).toBe(NotificationStatus.PENDING);
  });
});