import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

const futureDate = () => new Date(Date.now() + 1000 * 60 * 60);

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<Pick<PrismaService, 'user' | 'session'>>;
  let configService: ConfigService;
  let jwtService: JwtService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      session: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    } as unknown as jest.Mocked<Pick<PrismaService, 'user' | 'session'>>;

    jwtService = new JwtService({ secret: 'test-secret' });
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return 'test-secret';
        if (key === 'JWT_ACCESS_EXPIRES_IN') return 3600;
        if (key === 'JWT_REFRESH_EXPIRES_IN') return 7200;
        return undefined;
      }),
    } as unknown as ConfigService;

    service = new AuthService(prisma as unknown as PrismaService, jwtService, configService);
  });

  it('logs in a user and returns tokens', async () => {
    const password = 'supersafe123';
    const passwordHash = await bcrypt.hash(password, 10);
    const user = { id: 'user-1', email: 'person@example.com', passwordHash, role: Role.STAFF };

    prisma.user.findUnique.mockResolvedValue(user as any);
    prisma.session.create.mockResolvedValue({} as any);

    const result = await service.login({ email: user.email, password });

    expect(result.user).toMatchObject({ id: user.id, email: user.email, role: user.role });
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toContain('.');
    expect(prisma.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: user.id }),
      }),
    );
  });

  it('rotates refresh tokens on refresh', async () => {
    const password = 'anotherSecret1';
    const passwordHash = await bcrypt.hash(password, 10);
    const user = { id: 'user-2', email: 'rotate@example.com', passwordHash, role: Role.HOST };

    prisma.user.findUnique.mockImplementation(async (args: any) => {
      if (args.where.email === user.email) {
        return user as any;
      }
      if (args.where.id === user.id) {
        return user as any;
      }
      return null;
    });
    prisma.user.findUniqueOrThrow.mockResolvedValue(user as any);

    const sessionId = 'session-1';
    const refreshSecret = 'refresh-secret';
    const refreshHash = await bcrypt.hash(refreshSecret, 10);

    prisma.session.findUnique.mockResolvedValue({
      id: sessionId,
      userId: user.id,
      tokenHash: refreshHash,
      expiresAt: futureDate(),
    } as any);

    prisma.session.update.mockResolvedValue({} as any);

    const result = await service.refresh({ refreshToken: `${sessionId}.${refreshSecret}` });

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toContain(sessionId);
    expect(prisma.session.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: sessionId } }),
    );
  });
});
