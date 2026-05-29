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
  },

  gatherleads: {
    secret: process.env.GATHERLEADS_SECRET ?? '',
    signatureHeader: (process.env.GATHERLEADS_SIGNATURE_HEADER ?? 'x-gatherleads-signature').toLowerCase(),
    verifySignature: bool(process.env.GATHERLEADS_VERIFY_SIGNATURE, false),
  },

  skipUnmappedStages: bool(process.env.SKIP_UNMAPPED_STAGES, true),
} as const;

export function metaIsConfigured(): boolean {
  return Boolean(config.meta.pixelId && config.meta.accessToken);
}
