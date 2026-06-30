import dotenv from 'dotenv';

dotenv.config();

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    // No abortamos el arranque para permitir healthchecks, pero avisamos fuerte.
    // El envío a Meta fallará de forma controlada si falta la credencial.
    // eslint-disable-next-line no-console
    console.warn(`[config] Falta la variable de entorno ${name}. La integración con Meta no funcionará hasta configurarla.`);
  }
  return value ?? '';
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'y', 'on'].includes(value.trim().toLowerCase());
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  logLevel: (process.env.LOG_LEVEL ?? 'info') as 'debug' | 'info' | 'warn' | 'error',

  meta: {
    pixelId: required('META_PIXEL_ID', process.env.META_PIXEL_ID),
    accessToken: required('META_ACCESS_TOKEN', process.env.META_ACCESS_TOKEN),
    graphVersion: process.env.META_GRAPH_API_VERSION ?? 'v21.0',
    testEventCode: process.env.META_TEST_EVENT_CODE?.trim() || undefined,
    // Meta exige currency (y value) en eventos Purchase. Ecuador usa USD.
    defaultCurrency: (process.env.META_DEFAULT_CURRENCY ?? 'USD').trim().toUpperCase(),
    // value por defecto cuando el payload no trae monto de venta.
    defaultPurchaseValue: Number(process.env.META_DEFAULT_PURCHASE_VALUE ?? 0),
    // Nombre de la fuente CRM para eventos Conversion Leads (custom_data.lead_event_source).
    leadEventSource: (process.env.META_LEAD_EVENT_SOURCE ?? 'ASSA CRM').trim(),
  },

  gatherleads: {
    secret: process.env.GATHERLEADS_SECRET ?? '',
    signatureHeader: (process.env.GATHERLEADS_SIGNATURE_HEADER ?? 'x-gatherleads-signature').toLowerCase(),
    verifySignature: bool(process.env.GATHERLEADS_VERIFY_SIGNATURE, false),
    // (Opcional) Nombre exacto del campo del payload que contiene el Meta
    // leadgen_id. Si se deja vacío, se autodetecta un valor de 15-17 dígitos.
    leadIdField: process.env.GATHERLEADS_LEAD_ID_FIELD?.trim() || undefined,
  },

  skipUnmappedStages: bool(process.env.SKIP_UNMAPPED_STAGES, true),
} as const;

export function metaIsConfigured(): boolean {
  return Boolean(config.meta.pixelId && config.meta.accessToken);
}
