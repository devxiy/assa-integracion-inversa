import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../config';
import { logger } from '../logger';

/**
 * Verificación de la firma del webhook usando la Secret Key.
 *
 * IMPORTANTE: La documentación de GatherLeads indica que el header exacto y el
 * algoritmo de firma deben confirmarse con su equipo. Esta implementación
 * asume HMAC-SHA256 sobre el cuerpo crudo (raw body), codificado en hex,
 * que es el esquema más común. Ajusta `computeSignature` si GatherLeads usa
 * otro algoritmo/codificación (ej. base64, prefijo "sha256=", etc.).
 *
 * Se controla con GATHERLEADS_VERIFY_SIGNATURE. Mientras no se confirme el
 * mecanismo, déjalo en "false" para no rechazar eventos válidos.
 */

function computeSignature(rawBody: Buffer): string {
  return createHmac('sha256', config.gatherleads.secret).update(rawBody).digest('hex');
}

function safeCompare(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export interface SignatureCheck {
  valid: boolean;
  /** true si la verificación está desactivada por configuración. */
  skipped: boolean;
  reason?: string;
}

export function verifySignature(rawBody: Buffer | undefined, headerValue: string | undefined): SignatureCheck {
  if (!config.gatherleads.verifySignature) {
    return { valid: true, skipped: true };
  }
  if (!config.gatherleads.secret) {
    logger.warn('Verificación de firma activada pero falta GATHERLEADS_SECRET.');
    return { valid: false, skipped: false, reason: 'missing_secret' };
  }
  if (!rawBody || !headerValue) {
    return { valid: false, skipped: false, reason: 'missing_signature_or_body' };
  }

  // Acepta tanto "<hex>" como "sha256=<hex>".
  const provided = headerValue.startsWith('sha256=') ? headerValue.slice('sha256='.length) : headerValue;
  const expected = computeSignature(rawBody);
  const valid = safeCompare(provided, expected);
  return { valid, skipped: false, reason: valid ? undefined : 'signature_mismatch' };
}
