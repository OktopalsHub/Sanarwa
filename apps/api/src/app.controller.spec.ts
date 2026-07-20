import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { appConfig } from './config';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [appConfig],
        }),
      ],
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('returns the health payload', () => {
      const response = appController.getHello();

      expect(response).toMatchObject({
        status: 'ok',
        message: 'Sanarwa Server is running!',
        version: '1.0.0',
      });
      expect(response.timestamp).toBeDefined();
    });
  });
});
