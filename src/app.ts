import express, { Express, Request, Response } from 'express';
import { metaIsConfigured } from './config';
import { handleGatherLeadsWebhook } from './webhook/handler';
import { listBrands } from './mappings/stages';
import { FUNNEL_STAGES, buildEventName } from './mappings/eventMap';

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

  // Raíz: información básica del servicio.
  app.get('/', (_req: Request, res: Response) => {
    res.status(200).json({
      service: 'GatherLeads → Meta Conversions API',
      status: 'ok',
      metaConfigured: metaIsConfigured(),
      endpoints: ['POST /webhook/gatherleads', 'GET /health', 'GET /mappings'],
    });
  });

  // Healthcheck.
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      metaConfigured: metaIsConfigured(),
      brands: listBrands().length,
    });
  });

  // Referencia rápida de la estrategia de eventos (Marca + Etapa) para QA.
  app.get('/mappings', (_req: Request, res: Response) => {
    const brands = listBrands();
    const stages = [...FUNNEL_STAGES['Contact Center'], ...FUNNEL_STAGES['Ventas']];
    const example = brands[0]?.brand ?? 'Chevrolet Pesados';
    res.status(200).json({
      strategy: 'event_name = {Marca}_{Etapa}',
      brands,
      funnelStages: FUNNEL_STAGES,
      exampleEventNames: stages.map((s) => buildEventName(example, s)),
    });
  });

  // Endpoint del webhook de GatherLeads.
  app.post('/webhook/gatherleads', handleGatherLeadsWebhook);

  return app;
}
