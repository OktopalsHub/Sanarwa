import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './modules/auth/decorators/public.decorator';

@Controller({ version: VERSION_NEUTRAL })
@Public()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello() {
    return {
      status: 'ok',
      message: 'Sanarwa Server is running!',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }
}
