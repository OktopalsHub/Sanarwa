import { User } from "../../modules/user/entities/user.entity";
import { AuthProvider, UserRole } from "../../common/enums";
import { DeepPartial } from "typeorm";

export class UserFactory {
  static create(overrides: DeepPartial<User> = {}): User {
    const defaultUser: DeepPartial<User> = {
      id: "user-" + Math.random().toString(36).substr(2, 9),
      email: "test@example.com",
      name: "Test User",
      password: "$argon2id$v=19$m=65536,t=3,p=4$hashed_password",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const user = { ...defaultUser, ...overrides } as User;

    return user;
  }

  static createMany(count: number, overrides: DeepPartial<User> = {}): User[] {
    return Array.from({ length: count }, (_, index) =>
      this.create({
        ...overrides,
        id: `user-${index + 1}`,
        email: `test${index + 1}@example.com`,
        name: `Test${index + 1} User`,
      }),
    );
  }

  static createAdmin(overrides: DeepPartial<User> = {}): User {
    return this.create({
      ...overrides,
      email: "admin@example.com",
      name: "Admin User",
    });
  }

  static createWithEmail(email: string, overrides: DeepPartial<User> = {}): User {
    return this.create({ ...overrides, email });
  }

  static createSanitized(overrides: DeepPartial<User> = {}): Omit<User, "password"> {
    const user = this.create(overrides);
    const { password, ...sanitized } = user;
    return sanitized as Omit<User, "password">;
  }
}
