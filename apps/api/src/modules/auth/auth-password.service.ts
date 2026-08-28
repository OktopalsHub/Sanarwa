import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as argon2 from "argon2";
import { Repository } from "typeorm";
import { User } from "../user/entities/user.entity";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { Account } from "./entities/account.entity";

@Injectable()
export class AuthPasswordService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user?.password) {
      throw new UnauthorizedException("User not found");
    }

    const isPasswordValid = await argon2.verify(user.password, currentPassword);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    const newHashedPassword = await argon2.hash(newPassword);
    user.password = newHashedPassword;
    await this.userRepository.save(user);

    const account = await this.accountRepository.findOne({
      where: { userId, providerId: "credential" },
    });
    if (account) {
      account.password = newHashedPassword;
      await this.accountRepository.save(account);
    }

    return { message: "Password changed successfully" };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const user = await this.userRepository.findOne({ where: { email: forgotPasswordDto.email } });
    if (!user) {
      return { message: "If email exists, reset link will be sent" };
    }
    return { message: "If email exists, reset link will be sent" };
  }

  async resetPassword(_resetPasswordDto: ResetPasswordDto) {
    throw new BadRequestException("Invalid or expired reset token");
  }
}
