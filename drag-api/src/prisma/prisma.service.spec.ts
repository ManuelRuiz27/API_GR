import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  const config = {
    get: jest.fn(() => 'postgresql://postgres:postgres@localhost:5432/test?schema=public'),
  } as unknown as ConfigService;

  it('connects and disconnects with lifecycle hooks', async () => {
    const service = new PrismaService(config);
    const connectSpy = jest.spyOn(service, '$connect').mockResolvedValue();
    const disconnectSpy = jest.spyOn(service, '$disconnect').mockResolvedValue();

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(connectSpy).toHaveBeenCalled();
    expect(disconnectSpy).toHaveBeenCalled();
  });

  it('registers shutdown hooks to close the Nest application', async () => {
    const service = new PrismaService(config);
    const app = { close: jest.fn().mockResolvedValue(undefined) } as unknown as INestApplication;

    const beforeExitHandlers: Array<() => Promise<void>> = [];
    jest.spyOn(service, '$on').mockImplementation((event: any, handler: any) => {
      if (event === 'beforeExit') {
        beforeExitHandlers.push(handler);
      }
      return service;
    });

    await service.enableShutdownHooks(app);

    expect(beforeExitHandlers).toHaveLength(1);
    await beforeExitHandlers[0]!();
    expect(app.close).toHaveBeenCalled();
  });
});
