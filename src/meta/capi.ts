import { config, metaIsConfigured } from '../config';
import { logger } from '../logger';

/** Datos de usuario (ya hasheados donde corresponde) para Advanced Matching. */
export interface MetaUserData {
  em?: string[];
  ph?: string[];
  fn?: string[];
  ln?: string[];
  external_id?: string[];
  /** País (ISO 2 letras) hasheado. */
  country?: string[];
  /** Meta lead_id (Conversion Leads). Numérico, NO se hashea. */
  lead_id?: number;
  [key: string]: unknown;
}

export interface MetaServerEvent {
  event_name: string;
  event_time: number;
  action_source: string;
  event_id?: string;
  event_source_url?: string;
  user_data: MetaUserData;
  custom_data?: Record<string, unknown>;
}

export interface MetaSendResult {
  ok: boolean;
  status: number;
  body: unknown;
}

/**
 * Envía uno o más eventos al endpoint de Conversions API de un único Pixel.
 * https://graph.facebook.com/{version}/{PIXEL_ID}/events
 */
export async function sendEvents(events: MetaServerEvent[]): Promise<MetaSendResult> {
  if (!metaIsConfigured()) {
    logger.error('Meta no está configurado (falta META_PIXEL_ID o META_ACCESS_TOKEN). No se envía el evento.');
    return { ok: false, status: 0, body: { error: 'meta_not_configured' } };
  }

  if (events.length === 0) {
    return { ok: true, status: 200, body: { skipped: true } };
  }

  const url = `https://graph.facebook.com/${config.meta.graphVersion}/${config.meta.pixelId}/events`;

  const payload: Record<string, unknown> = {
    data: events,
    access_token: config.meta.accessToken,
  };
  if (config.meta.testEventCode) {
    payload.test_event_code = config.meta.testEventCode;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      logger.error('Meta CAPI respondió con error', { status: res.status, body });
      return { ok: false, status: res.status, body };
    }

    logger.info('Eventos enviados a Meta CAPI', {
      status: res.status,
      events: events.map((e) => ({
        name: e.event_name,
        brand: e.custom_data?.brand,
        stage: e.custom_data?.funnel_stage,
      })),
      body,
    });
    return { ok: true, status: res.status, body };
  } catch (err) {
    logger.error('Fallo de red al enviar a Meta CAPI', { error: String(err) });
    return { ok: false, status: 0, body: { error: String(err) } };
  }
}
