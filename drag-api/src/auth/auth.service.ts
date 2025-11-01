import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, Session, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthTokens } from './interfaces/auth-tokens.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { resolveDurationToSeconds } from './utils/duration';

interface AuthResponse extends AuthTokens {
  user: Pick<User, 'id' | 'email' | 'role'>;
}

@Injectable()
export class AuthService {
  private static readonly ACCESS_FALLBACK_SECONDS = 15 * 60; // 15 minutes
  private static readonly REFRESH_FALLBACK_SECONDS = 60 * 60 * 24 * 7; // 7 days

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokens(user);
    return {
      ...tokens,
      user: this.toPublicUser(user),
    };
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthResponse> {
    const { sessionId, secret } = this.extractRefreshToken(dto.refreshToken);

    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const isValid = await bcrypt.compare(secret, session.tokenHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.rotateSession(session);

    return {
      ...tokens,
      user: this.toPublicUser(user),
    };
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as Role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET', 'local-secret'),
      expiresIn: this.getAccessTokenExpirySeconds(),
    });

    const refreshToken = await this.createSession(user.id);

    return { accessToken, refreshToken };
  }

  private async rotateSession(session: Session): Promise<AuthTokens> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as Role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET', 'local-secret'),
      expiresIn: this.getAccessTokenExpirySeconds(),
    });

    const { secret, tokenHash, expiresAt } = await this.generateRefreshSecret();
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        tokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: `${session.id}.${secret}`,
    };
  }

  private async createSession(userId: string): Promise<string> {
    const { secret, tokenHash, expiresAt, sessionId } = await this.generateRefreshSecret(true);
    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return `${sessionId}.${secret}`;
  }

  private async generateRefreshSecret(withId = false): Promise<{
    secret: string;
    tokenHash: string;
    expiresAt: Date;
    sessionId: string;
  }> {
    const secret = randomBytes(48).toString('hex');
    const tokenHash = await bcrypt.hash(secret, 10);
    const expiresAt = new Date(Date.now() + this.getRefreshTokenExpirySeconds() * 1000);
    const sessionId = withId ? randomUUID() : '';
    return { secret, tokenHash, expiresAt, sessionId };
  }

  private getAccessTokenExpirySeconds(): number {
    const raw = this.configService.get<string | number>('JWT_ACCESS_EXPIRES_IN');
    return resolveDurationToSeconds(raw, AuthService.ACCESS_FALLBACK_SECONDS);
  }

  private getRefreshTokenExpirySeconds(): number {
    const raw = this.configService.get<string | number>('JWT_REFRESH_EXPIRES_IN');
    return resolveDurationToSeconds(raw, AuthService.REFRESH_FALLBACK_SECONDS);
  }

  private extractRefreshToken(refreshToken: string): { sessionId: string; secret: string } {
    const parts = refreshToken.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new UnauthorizedException('Malformed refresh token');
    }

    return { sessionId: parts[0], secret: parts[1] };
  }

  private toPublicUser(user: User): Pick<User, 'id' | 'email' | 'role'> {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
