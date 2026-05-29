import express, { Express, Request, Response } from 'express';
import { metaIsConfigured } from './config';
import { handleGatherLeadsWebhook } from './webhook/handler';
import { listBrands } from './mappings/stages';
import { STAGE_EVENT_MAP } from './mappings/eventMap';

/** Construye la app de Express (sin arrancar el servidor). */
export function createApp(): Express {
  const app = express();

  // Capturamos el rawBody para poder verificar la firma del webhook.
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );

  // Healthcheck.
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      metaConfigured: metaIsConfigured(),
      brands: listBrands().length,
    });
  });

  // Referencia rápida del mapeo etapa -> evento de Meta (útil para QA).
  app.get('/mappings', (_req: Request, res: Response) => {
    res.status(200).json({
      brands: listBrands(),
      stageToMetaEvent: STAGE_EVENT_MAP,
    });
  });

  // Endpoint del webhook de GatherLeads.
  app.post('/webhook/gatherleads', handleGatherLeadsWebhook);

  return app;
}
