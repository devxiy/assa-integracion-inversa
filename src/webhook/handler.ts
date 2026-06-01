import { Request, Response } from 'express';
import { config } from '../config';
import { logger } from '../logger';
import { GatherLeadsEvent } from '../types';
import { seen } from './idempotency';
import { verifySignature } from './signature';
import { transform } from './transform';
import { sendEvents } from '../meta/capi';

/** Lee el rawBody capturado por el middleware de express.json. */
function getRawBody(req: Request): Buffer | undefined {
  return (req as Request & { rawBody?: Buffer }).rawBody;
}

export async function handleGatherLeadsWebhook(req: Request, res: Response): Promise<void> {
  // 1) Verificación de firma (si está activada).
  const sig = verifySignature(getRawBody(req), req.header(config.gatherleads.signatureHeader));
  if (!sig.valid) {
    logger.warn('Firma inválida — evento rechazado', { reason: sig.reason });
    res.status(401).json({ error: 'invalid_signature', reason: sig.reason });
    return;
  }

  const event = req.body as GatherLeadsEvent;

  if (!event || typeof event.eventId !== 'string' || typeof event.eventType !== 'string') {
    logger.warn('Payload inválido o incompleto', { body: event });
    res.status(400).json({ error: 'invalid_payload' });
    return;
  }

  // 2) Idempotencia por eventId.
  if (seen(event.eventId)) {
    logger.info('Evento duplicado ignorado', { eventId: event.eventId });
    res.status(200).json({ status: 'duplicate_ignored', eventId: event.eventId });
    return;
  }

  // 3) Transformación GatherLeads -> Meta.
  const { event: metaEvent, reason } = transform(event);

  if (!metaEvent) {
    logger.debug('Evento no mapeado a Meta', { eventId: event.eventId, reason });
    // Respondemos 200 para que GatherLeads no reintente un evento que
    // deliberadamente no enviamos.
    res.status(200).json({ status: 'skipped', reason });
    return;
  }

  // 4) Envío a Meta Conversions API.
  const result = await sendEvents([metaEvent]);

  if (!result.ok) {
    // 502 para que GatherLeads pueda reintentar ante fallos transitorios de Meta.
    logger.error('No se pudo entregar el evento a Meta', { eventId: event.eventId, status: result.status });
    res.status(502).json({ status: 'meta_error', metaStatus: result.status, body: result.body });
    return;
  }

  res.status(200).json({
    status: 'forwarded',
    metaEvent: metaEvent.event_name,
    brand: metaEvent.custom_data?.brand,
    reason,
  });
}
