import { Injectable, NotFoundException } from '@nestjs/common';
import { Layout, LayoutStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLayoutDto } from './dto/create-layout.dto';
import { PublishLayoutDto } from './dto/publish-layout.dto';
import { UpdateLayoutDto } from './dto/update-layout.dto';
import { ElementConfig } from './types/element-config';

interface LayoutPayload {
  elements: ElementConfig[];
  tags: string[];
}

export interface LayoutResponse {
  id: string;
  name: string;
  description?: string | null;
  venueId: string;
  zoneId?: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date | null;
  status: LayoutStatus;
  createdBy?: string | null;
  elements: ElementConfig[];
  tags: string[];
}

@Injectable()
export class LayoutsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLayoutDto, actorId?: string): Promise<LayoutResponse> {
    const payload = this.createPayload(dto.elements, dto.tags);
    const status = dto.status ?? LayoutStatus.DRAFT;

    const layout = await this.prisma.$transaction(async (tx) => {
      const created = await tx.layout.create({
        data: {
          name: dto.name,
          description: dto.description,
          venueId: dto.venueId,
          zoneId: dto.zoneId,
          status,
          json: payload,
          createdBy: actorId,
        },
      });

      await tx.layoutVersion.create({
        data: {
          layoutId: created.id,
          version: created.version,
          json: payload,
          createdBy: actorId,
        },
      });

      return created;
    });

    return this.toResponse(layout);
  }

  async findAll(): Promise<LayoutResponse[]> {
    const layouts = await this.prisma.layout.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return layouts.map((layout) => this.toResponse(layout));
  }

  async findOne(id: string): Promise<LayoutResponse> {
    const layout = await this.prisma.layout.findUnique({ where: { id } });
    if (!layout) {
      throw new NotFoundException(`Layout ${id} not found`);
    }

    return this.toResponse(layout);
  }

  async update(id: string, dto: UpdateLayoutDto, actorId?: string): Promise<LayoutResponse> {
    const layout = await this.prisma.layout.findUnique({ where: { id } });
    if (!layout) {
      throw new NotFoundException(`Layout ${id} not found`);
    }

    const nextVersion = layout.version + 1;
    const payload = this.mergePayload(layout.json as LayoutPayload, dto.elements, dto.tags);

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.layout.update({
        where: { id },
        data: {
          name: dto.name ?? layout.name,
          description: dto.description ?? layout.description,
          venueId: dto.venueId ?? layout.venueId,
          zoneId: dto.zoneId ?? layout.zoneId,
          status: dto.status ?? layout.status,
          version: nextVersion,
          json: payload,
        },
      });

      await tx.layoutVersion.create({
        data: {
          layoutId: id,
          version: nextVersion,
          json: payload,
          createdBy: actorId,
        },
      });

      return saved;
    });

    return this.toResponse(updated);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.layout.delete({ where: { id } });
  }

  async publish(id: string, dto: PublishLayoutDto, actorId?: string): Promise<LayoutResponse> {
    const publishDate = dto.publishAt ? new Date(dto.publishAt) : new Date();

    const updated = await this.prisma.layout.update({
      where: { id },
      data: {
        publishedAt: publishDate,
        status: LayoutStatus.PUBLISHED,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'layout.published',
        resourceType: 'layout',
        resourceId: id,
        actorId: actorId,
        metadata: {
          eventId: dto.eventId,
          publishedAt: publishDate.toISOString(),
        } as Prisma.JsonValue,
      },
    });

    return this.toResponse(updated);
  }

  private createPayload(elements: ElementConfig[], tags?: string[]): LayoutPayload {
    return {
      elements,
      tags: tags ?? [],
    };
  }

  private mergePayload(
    existing: LayoutPayload | null | undefined,
    elements?: ElementConfig[],
    tags?: string[],
  ): LayoutPayload {
    return {
      elements: elements ?? existing?.elements ?? [],
      tags: tags ?? existing?.tags ?? [],
    };
  }

  private toResponse(layout: Layout): LayoutResponse {
    const payload = (layout.json as LayoutPayload | null) ?? { elements: [], tags: [] };
    return {
      id: layout.id,
      name: layout.name,
      description: layout.description,
      venueId: layout.venueId,
      zoneId: layout.zoneId,
      version: layout.version,
      createdAt: layout.createdAt,
      updatedAt: layout.updatedAt,
      publishedAt: layout.publishedAt,
      status: layout.status,
      createdBy: layout.createdBy,
      elements: payload?.elements ?? [],
      tags: payload?.tags ?? [],
    };
  }
}
