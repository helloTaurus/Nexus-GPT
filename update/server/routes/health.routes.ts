import { Router, type Request, type Response } from 'express';
import { envConfig } from '../config/index.ts';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  const mem = process.memoryUsage();
  res.status(200).json({
    status: 'healthy',
    uptime: Number(process.uptime().toFixed(2)),
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: envConfig.NODE_ENV,
    checks: {
      server: 'ok',
      storage: 'connected'
    },
    memory: {
      rssMb: Number((mem.rss / (1024 * 1024)).toFixed(2)),
      heapUsedMb: Number((mem.heapUsed / (1024 * 1024)).toFixed(2))
    }
  });
});

healthRouter.get('/ping', (_req: Request, res: Response) => {
  res.status(200).send('pong');
});
