import { User } from '../../modules/user/entities/user.entity';

export class UserCreatedEvent {
  constructor(public readonly user: User) {}
}

export class UserRegisteredEvent {
  constructor(
    public readonly userId: string,
    public readonly workspaceName: string,
  ) {}
}
