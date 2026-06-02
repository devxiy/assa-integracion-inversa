/**
 * Estrategia de nombres de evento: MARCA + ETAPA.
 *
 * Cada evento que se envía a Meta se nombra como `{Marca}_{Etapa}` (en
 * PascalCase, sin acentos ni espacios), de modo que cada combinación
 * marca/etapa del funnel es un evento DISTINTO y optimizable directamente en
 * campañas (ej. `ChevroletPesados_Cotizacion`, `VWLivianos_Cierre`).
 *
 * Se envían TODAS las etapas del funnel (pipelines Contact Center y Ventas).
 * La marca también viaja en `custom_data` (brand, license_id, content_category)
 * para reportes y desgloses.
 */

/** Convierte un texto a un token ASCII PascalCase apto para nombres de evento de Meta. */
export function toEventToken(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos (á -> a)
    .replace(/[^a-zA-Z0-9\s]/g, ' ') // cualquier no alfanumérico -> espacio
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

/** Construye el nombre del evento de Meta a partir de la marca y la etiqueta (etapa). */
export function buildEventName(brand: string, label: string): string {
  const b = toEventToken(brand);
  const l = toEventToken(label);
  return b ? `${b}_${l}` : l;
}

/** Etiqueta usada cuando se crea el lead y no hay una etapa resoluble. */
export const CREATED_FALLBACK_LABEL = 'Lead';

/**
 * Etiqueta para la tipificación del lead (cualificación por el asesor).
 * Se combina con la marca: `{Marca}_LeadCualificado`. `null` para no enviarlo.
 */
export const TYPIFICATION_LABEL: string | null = 'LeadCualificado';

/**
 * Etapas que representan cierre/venta y por tanto envían `value` + `currency`
 * (útil para optimización por valor / ROAS).
 */
const VALUE_STAGES = new Set<string>(['Cierre']);

/** Indica si una etapa debe incluir value + currency en el evento. */
export function stageRequiresValue(stageName: string | undefined): boolean {
  return stageName ? VALUE_STAGES.has(stageName) : false;
}

/** Todas las etapas del funnel por pipeline (referencia para QA / endpoint /mappings). */
export const FUNNEL_STAGES: Record<string, string[]> = {
  'Contact Center': [
    'Prospección Bruta',
    'Base Prospección',
    'Gestión',
    'Prospección',
    'Cita',
    'Cita Confirmada',
  ],
  Ventas: [
    'Tráfico',
    'Test Drive',
    'Cotización',
    'Reservas',
    'Solicitudes Crédito',
    'Solicitudes Aprobadas',
    'Cierre',
    'Perdido',
  ],
};
