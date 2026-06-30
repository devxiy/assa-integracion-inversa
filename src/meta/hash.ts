import { createHash } from 'crypto';

/**
 * Normaliza y aplica SHA-256 a un valor de datos de usuario, según los
 * requisitos de Meta Conversions API (Advanced Matching).
 * Meta exige minúsculas + trim antes de hashear (excepto en casos puntuales).
 */
function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeBasic(value: string): string {
  return value.trim().toLowerCase();
}

export function hashEmail(email?: string): string | undefined {
  if (!email) return undefined;
  const v = normalizeBasic(email);
  if (!v) return undefined;
  return sha256(v);
}

/**
 * Teléfono: Meta requiere solo dígitos (sin "+", espacios ni guiones),
 * incluyendo el código de país. Ej: "+593988999889" -> "593988999889".
 */
export function hashPhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/[^0-9]/g, '');
  if (!digits) return undefined;
  return sha256(digits);
}

export function hashName(name?: string): string | undefined {
  if (!name) return undefined;
  const v = normalizeBasic(name);
  if (!v) return undefined;
  return sha256(v);
}

/**
 * external_id / identificación. Se hashea normalizando a minúsculas y trim.
 */
export function hashExternalId(id?: string): string | undefined {
  if (!id) return undefined;
  const v = normalizeBasic(String(id));
  if (!v) return undefined;
  return sha256(v);
}

/**
 * País: Meta requiere el código ISO de 2 letras en minúsculas. Ej: "ec".
 */
export function hashCountry(country?: string): string | undefined {
  if (!country) return undefined;
  const v = normalizeBasic(country);
  if (!v) return undefined;
  return sha256(v);
}
