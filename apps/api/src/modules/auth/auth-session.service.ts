import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { Repository } from "typeorm";
import { Session } from "./entities/session.entity";

@Injectable()
export class AuthSessionService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
  ) {}

  async createSession(userId: string): Promise<void> {
    const session = this.sessionRepository.create({
      id: randomUUID(),
      userId,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: null,
      userAgent: null,
    });
    await this.sessionRepository.save(session);
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.sessionRepository.delete({ userId });
    return { message: "Logged out successfully" };
  }
}
