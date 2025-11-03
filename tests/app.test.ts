import request from 'supertest';

jest.mock('../src/prisma', () => {
  const layout = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };
  const prismaMock = {
    layout,
    $queryRaw: jest.fn(),
  };

  return {
    __esModule: true,
    default: prismaMock,
    prisma: prismaMock,
  };
});

import app from '../src/index';
import prisma from '../src/prisma';

type MockedPrisma = jest.Mocked<typeof prisma>;

const mockPrisma = prisma as MockedPrisma;

describe('REST API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.API_TOKEN;
  });

  it('returns ok status for GET /api/health', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([] as never);

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(mockPrisma.$queryRaw).toHaveBeenCalled();
  });

  it('validates the presence of the name field on POST /api/layouts', async () => {
    const response = await request(app)
      .post('/api/layouts')
      .send({ data: {} });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('The name field is required');
    expect(mockPrisma.layout.create).not.toHaveBeenCalled();
  });

  it('validates JSON input on POST /api/layouts', async () => {
    const response = await request(app)
      .post('/api/layouts')
      .send({ name: 'Test layout', data: '{not json}' });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('Invalid JSON provided in data field');
    expect(mockPrisma.layout.create).not.toHaveBeenCalled();
  });

  it('creates a layout when valid data is provided', async () => {
    const now = new Date().toISOString();
    const layout = {
      id: 'layout-1',
      name: 'Valid layout',
      data: { foo: 'bar' },
      createdAt: now,
      updatedAt: now,
    };

    mockPrisma.layout.create.mockResolvedValueOnce(layout as never);

    const response = await request(app)
      .post('/api/layouts')
      .send({ name: 'Valid layout', data: { foo: 'bar' } });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ data: layout });
    expect(mockPrisma.layout.create).toHaveBeenCalledWith({
      data: {
        name: 'Valid layout',
        data: { foo: 'bar' },
      },
    });
  });

  it('returns layout data for GET /api/layouts', async () => {
    const now = new Date().toISOString();
    const layouts = [
      {
        id: 'layout-1',
        name: 'Layout One',
        data: { foo: 'bar' },
        createdAt: now,
        updatedAt: now,
      },
    ];

    mockPrisma.layout.findMany.mockResolvedValueOnce(layouts as never);

    const response = await request(app).get('/api/layouts');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: layouts });
    expect(mockPrisma.layout.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
    });
  });
});
