export class InviteCreatedEvent {
  constructor(
    public readonly inviteId: string,
    public readonly email: string,
    public readonly tenantId: string,
    public readonly token: string,
    public readonly invitedBy: string,
    public readonly message?: string,
  ) {}
}

export class InviteAcceptedEvent {
  constructor(
    public readonly inviteId: string,
    public readonly userId: string,
    public readonly tenantId: string,
    public readonly role: string,
  ) {}
}

export class InviteDeclinedEvent {
  constructor(
    public readonly inviteId: string,
    public readonly email: string,
    public readonly tenantId: string,
  ) {}
}
