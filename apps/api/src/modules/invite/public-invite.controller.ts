import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { AcceptInviteResponseDto } from './dto/accept-invite-response.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { InviteService } from './invite.service';

@ApiTags('Public Invites')
@Controller('invites')
export class PublicInviteController {
  constructor(private readonly inviteService: InviteService) { }

  @Post('accept')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept an invitation',
    description: 'Accept a tenant invitation with optional password for email/password authentication or OAuth flow'
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation accepted successfully',
    type: AcceptInviteResponseDto
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  async acceptInvite(@Body() acceptInviteDto: AcceptInviteDto): Promise<AcceptInviteResponseDto> {
    return this.inviteService.acceptInvite(acceptInviteDto);
  }

  @Post(':token/decline')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Decline an invitation' })
  @ApiResponse({ status: 204, description: 'Invitation declined successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  async declineInvite(@Param('token') token: string) {
    await this.inviteService.declineInvite(token);
  }

  @Get(':token')
  @Public()
  @ApiOperation({ summary: 'Get invitation details by token' })
  @ApiResponse({ status: 200, description: 'Invitation details retrieved' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  async getInviteByToken(@Param('token') token: string) {
    return this.inviteService.getInviteByToken(token);
  }
}
