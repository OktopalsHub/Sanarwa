export class AcceptInviteResponseDto {
  message: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  tenant: {
    id: string;
    name: string;
  };
  membership: {
    role: string;
    joinedAt: Date;
  };
}