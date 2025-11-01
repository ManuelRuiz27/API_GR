import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  const url = await app.getUrl();
  console.log(`Drag API is running on: ${url}`);
}

void bootstrap();
