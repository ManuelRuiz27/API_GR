import { BadRequestException, Injectable } from '@nestjs/common';
import { MediaAsset } from '@prisma/client';
import type { Express } from 'express';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIconDto } from './dto/create-icon.dto';

@Injectable()
export class IconsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<MediaAsset[]> {
    return this.prisma.mediaAsset.findMany({
      where: { kind: 'ICON' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateIconDto, file: Express.Multer.File): Promise<MediaAsset> {
    if (!file) {
      throw new BadRequestException('File upload is required');
    }

    const uploadsDir = join(process.cwd(), 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    const extension = file.originalname.split('.').pop();
    const filename = `${randomUUID()}.${extension ?? 'bin'}`;
    const absolutePath = join(uploadsDir, filename);
    await fs.writeFile(absolutePath, file.buffer);

    const asset = await this.prisma.mediaAsset.create({
      data: {
        name: dto.name,
        kind: 'ICON',
        url: `/uploads/${filename}`,
        filePath: absolutePath,
        tags: dto.tags ?? [],
      },
    });

    return asset;
  }
}
