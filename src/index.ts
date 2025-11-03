import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Layout, Prisma } from '@prisma/client';
import prisma from './prisma';

dotenv.config();

const app = express();
interface StructuredError {
  message: string;
  details?: unknown;
}

class ApiError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

const asyncHandler = (handler: AsyncRouteHandler) =>
  (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };

const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLine = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;
    console.log(logLine);
  });
  next();
};

const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const expectedToken = process.env.API_TOKEN;

  if (!expectedToken) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    next(new ApiError('Unauthorized', 401));
    return;
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || token !== expectedToken) {
    next(new ApiError('Unauthorized', 401));
    return;
  }

  next();
};

const ensureJsonData = (data: unknown): Layout['data'] => {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (error) {
      throw new ApiError('Invalid JSON provided in data field', 400, { error: String(error) });
    }
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  if (data === null) {
    return data;
  }

  if (Array.isArray(data) || typeof data === 'object') {
    return data as Layout['data'];
  }

  throw new ApiError('Unsupported type for data field', 400);
};

app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.get('/api/health', asyncHandler(async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ok' });
}));

app.use(authenticate);

app.get('/api/layouts', asyncHandler(async (_req, res) => {
  const layouts = await prisma.layout.findMany({
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: layouts });
}));

app.get('/api/layouts/:id', asyncHandler(async (req, res) => {
  const layout = await prisma.layout.findUnique({
    where: { id: req.params.id },
  });

  if (!layout) {
    throw new ApiError('Layout not found', 404);
  }

  res.json({ data: layout });
}));

app.post('/api/layouts', asyncHandler(async (req, res) => {
  const { name, data } = req.body ?? {};

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new ApiError('The name field is required', 400);
  }

  if (!Object.prototype.hasOwnProperty.call(req.body, 'data')) {
    throw new ApiError('The data field is required', 400);
  }

  const parsedData = ensureJsonData(data);

  const layout = await prisma.layout.create({
    data: {
      name: name.trim(),
      data: parsedData as Prisma.InputJsonValue,
    },
  });

  res.status(201).json({ data: layout });
}));

app.delete('/api/layouts/:id', asyncHandler(async (req, res) => {
  try {
    const layout = await prisma.layout.delete({
      where: { id: req.params.id },
    });
    res.json({ data: layout });
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'P2025') {
      throw new ApiError('Layout not found', 404);
    }
    throw error;
  }
}));

app.use((req, _res, next) => {
  next(new ApiError('Not Found', 404, { path: req.originalUrl }));
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const isApiError = err instanceof ApiError;
  const statusCode = isApiError ? err.statusCode : 500;
  const structuredError: StructuredError = {
    message: isApiError ? err.message : 'Internal Server Error',
    details: isApiError ? err.details : undefined,
  };

  if (!isApiError) {
    console.error(err);
  }

  res.status(statusCode).json({ error: structuredError });
});

const port = Number(process.env.PORT ?? 3000);

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

export default app;
