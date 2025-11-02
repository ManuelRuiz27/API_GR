import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Role, SeatStatus, WaitlistScope } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { prisma, resetDatabase } from './utils/setup-e2e';

describe('API flows (e2e)', () => {
  let app: INestApplication;
  let httpServer: any;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
    httpServer = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  const createStaffUser = async (password: string) => {
    const passwordHash = await bcrypt.hash(password, 10);
    return prisma.user.create({
      data: {
        email: 'staff@example.com',
        passwordHash,
        role: Role.STAFF,
      },
    });
  };

  const authenticate = async () => {
    const password = 'P@ssw0rd123';
    await createStaffUser(password);
    const response = await request(httpServer)
      .post('/api/auth/login')
      .send({ email: 'staff@example.com', password })
      .expect(200);

    return response.body as {
      accessToken: string;
      refreshToken: string;
      user: { id: string; email: string };
    };
  };

  it('exposes the health endpoint', async () => {
    const response = await request(httpServer).get('/api/health').expect(200);
    expect(response.text).toBe('OK');
  });

  it('authenticates a user and issues tokens', async () => {
    const tokens = await authenticate();

    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toMatch(/\./);
    expect(tokens.user.email).toBe('staff@example.com');
  });

  it('supports layout CRUD operations and publishing', async () => {
    const { accessToken, user } = await authenticate();

    const layoutPayload = {
      name: 'Main Hall',
      description: 'Night event',
      venueId: '11111111-1111-1111-1111-111111111111',
      elements: [
        {
          id: 'table-1',
          type: 'table',
          position: { x: 1, y: 2 },
          size: { width: 2, height: 1 },
        },
      ],
      tags: ['vip'],
    };

    const createResponse = await request(httpServer)
      .post('/api/layouts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(layoutPayload)
      .expect(201);

    expect(createResponse.body.name).toBe('Main Hall');
    const layoutId = createResponse.body.id as string;

    const listResponse = await request(httpServer)
      .get('/api/layouts')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(listResponse.body).toHaveLength(1);

    await request(httpServer)
      .put(`/api/layouts/${layoutId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Updated Hall' })
      .expect(200)
      .expect((res) => {
        expect(res.body.name).toBe('Updated Hall');
        expect(res.body.version).toBe(2);
      });

    await request(httpServer)
      .post(`/api/layouts/${layoutId}/publish`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ eventId: 'event-1' })
      .expect(202)
      .expect((res) => {
        expect(res.body.status).toBe('PUBLISHED');
        expect(res.body.createdBy).toBe(user.id);
      });

    await request(httpServer)
      .delete(`/api/layouts/${layoutId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    const remaining = await request(httpServer)
      .get('/api/layouts')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(remaining.body).toHaveLength(0);
  });

  it('returns a synthesized table map for an event', async () => {
    const { accessToken } = await authenticate();

    const layout = await prisma.layout.create({
      data: {
        name: 'Layout',
        venueId: '22222222-2222-2222-2222-222222222222',
        json: {
          elements: [
            {
              id: 'table-1',
              type: 'table',
              position: { x: 0, y: 0 },
              size: { width: 1, height: 1 },
            },
          ],
          tags: [],
        },
      },
    });

    const event = await prisma.event.create({
      data: {
        name: 'Launch',
        venueId: 'venue-1',
        layoutId: layout.id,
        startsAt: new Date('2024-05-01T20:00:00Z'),
      },
    });

    const table = await prisma.table.create({
      data: {
        eventId: event.id,
        layoutElementId: 'table-1',
        capacity: 4,
      },
    });

    const seats = await prisma.seat.createMany({
      data: [
        { tableId: table.id, label: 'A1', status: SeatStatus.AVAILABLE },
        { tableId: table.id, label: 'A2', status: SeatStatus.HELD },
        { tableId: table.id, label: 'A3', status: SeatStatus.RESERVED },
        { tableId: table.id, label: 'A4', status: SeatStatus.BLOCKED },
      ],
    });

    expect(seats.count).toBe(4);

    await prisma.waitlistEntry.createMany({
      data: [
        { eventId: event.id, scope: WaitlistScope.VENUE },
        { eventId: event.id, scope: WaitlistScope.USER },
        { eventId: event.id, scope: WaitlistScope.USER },
      ],
    });

    const response = await request(httpServer)
      .get('/api/table-map')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ eventId: event.id })
      .expect(200);

    expect(response.body.layoutId).toBe(layout.id);
    expect(response.body.availability).toHaveLength(1);
    expect(response.body.metadata.totalTables).toBe(1);
    expect(response.body.metadata.userWaitlistCount).toBe(2);
  });

  it('handles reservation lifecycle and SPEI payment confirmation', async () => {
    const { accessToken } = await authenticate();

    const layout = await prisma.layout.create({
      data: {
        name: 'Reservations Layout',
        venueId: '33333333-3333-3333-3333-333333333333',
        json: {
          elements: [
            {
              id: 'layout-table',
              type: 'table',
              position: { x: 2, y: 2 },
              size: { width: 2, height: 2 },
            },
          ],
          tags: ['reservations'],
        },
      },
    });

    const event = await prisma.event.create({
      data: {
        name: 'Gala Night',
        venueId: 'venue-2',
        layoutId: layout.id,
        startsAt: new Date('2024-06-15T21:00:00Z'),
      },
    });

    const table = await prisma.table.create({
      data: {
        eventId: event.id,
        layoutElementId: 'layout-table',
        capacity: 4,
      },
    });

    const seatRecords = await prisma.$transaction(
      Array.from({ length: 4 }).map((_, index) =>
        prisma.seat.create({
          data: {
            tableId: table.id,
            label: `B${index + 1}`,
          },
        }),
      ),
    );

    const holdResponse = await request(httpServer)
      .post('/api/reservations/hold')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        eventId: event.id,
        tableId: table.id,
        seatIds: seatRecords.slice(0, 2).map((seat) => seat.id),
      })
      .expect(201);

    const holdingToken = holdResponse.body.holdingToken as string;
    expect(holdingToken).toBeDefined();

    const confirmResponse = await request(httpServer)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        token: holdingToken,
        customerName: 'Jane Roe',
        customerEmail: 'jane.roe@example.com',
        totalAmount: 240,
        currency: 'MXN',
        items: [
          { description: 'Reservation Deposit', quantity: 2, unitPrice: 120 },
        ],
      })
      .expect(201);

    const { reservation, order } = confirmResponse.body;
    expect(reservation.status).toBe('CONFIRMED');
    expect(Number(order.totalAmount)).toBe(240);

    const speiReference = await request(httpServer)
      .post('/api/spei/references')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ orderId: order.id, bankCode: '999' })
      .expect(201);

    const reference = speiReference.body.reference as string;
    expect(reference).toHaveLength(18);

    await request(httpServer)
      .post('/api/spei/confirmations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reference, amount: 240, receiptUrl: 'https://example.com/receipt' })
      .expect(201)
      .expect((res) => {
        expect(res.body.success).toBe(true);
      });

    await request(httpServer)
      .delete(`/api/reservations/${reservation.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
      });

    const receipt = await request(httpServer)
      .get(`/api/spei/receipts/${reference}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(receipt.body.status).toBe('confirmed');
    expect(receipt.body.reference).toBe(reference);
  });
});
