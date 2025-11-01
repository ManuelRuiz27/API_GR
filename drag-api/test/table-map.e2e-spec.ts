import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { TablesModule } from '../src/tables/tables.module';
import { TablesService } from '../src/tables/tables.service';

const tableMapResponse = {
  layoutId: 'layout-1',
  eventId: 'event-1',
  version: 3,
  elements: [],
  availability: [],
  pricing: [],
  metadata: {
    totalTables: 2,
    availableTables: 1,
    availableSeats: 4,
    venueWaitlist: 2,
    userWaitlistCount: 5,
  },
};

describe('Table Map Endpoint (e2e)', () => {
  let app: INestApplication;
  let service: TablesService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TablesModule],
    })
      .overrideProvider(TablesService)
      .useValue({
        getTableMap: jest.fn().mockResolvedValue(tableMapResponse),
      })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    service = moduleRef.get<TablesService>(TablesService);
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the table map payload', async () => {
    await request(app.getHttpServer())
      .get('/api/table-map')
      .query({ eventId: 'event-1' })
      .expect(200)
      .expect(tableMapResponse);

    expect(service.getTableMap).toHaveBeenCalledWith('event-1', undefined);
  });
});
