/**
 * Mapeo de la etapa del funnel de GatherLeads -> evento de Meta.
 *
 * Estrategia (según lo solicitado): un ÚNICO Pixel para todas las marcas.
 * El evento se determina por la ETAPA del funnel; la MARCA viaja como
 * diferencial dentro de `custom_data` (brand, license_id, content_category),
 * de modo que en Meta Events Manager / Ads se puede segmentar por marca sin
 * necesidad de un pixel por marca.
 *
 * `null` significa "no enviar a Meta" (etapa intermedia sin valor publicitario).
 * Puedes ajustar libremente estos valores según la estrategia de medición.
 */

export interface MetaEventMapping {
  /** Nombre del evento en Meta. Estándar (Lead, Schedule, Purchase...) o personalizado. */
  eventName: string;
  /** true si es un evento estándar de Meta; false si es personalizado. */
  standard: boolean;
}

/** Evento al crearse el lead (deal.created). */
export const DEAL_CREATED_EVENT: MetaEventMapping = { eventName: 'Lead', standard: true };

/**
 * Evento cuando el asesor tipifica el lead (updatedFields.typification).
 * Útil para audiencias de leads cualificados. Pon `null` para no enviarlo.
 */
export const TYPIFICATION_EVENT: MetaEventMapping | null = {
  eventName: 'LeadCualificado',
  standard: false,
};

/**
 * Mapa por nombre de etapa (igual en todas las marcas).
 * Pipeline Contact Center y Ventas comparten este diccionario porque los
 * nombres de etapa no se solapan entre ambos.
 */
export const STAGE_EVENT_MAP: Record<string, MetaEventMapping | null> = {
  // ── Contact Center ──
  'Prospección Bruta': null,
  'Base Prospección': null,
  'Gestión': { eventName: 'Contact', standard: true },
  'Prospección': null,
  'Cita': { eventName: 'Schedule', standard: true },
  'Cita Confirmada': { eventName: 'CitaConfirmada', standard: false },

  // ── Ventas ──
  'Tráfico': { eventName: 'VisitaShowroom', standard: false },
  'Test Drive': { eventName: 'TestDrive', standard: false },
  'Cotización': { eventName: 'InitiateCheckout', standard: true },
  'Reservas': { eventName: 'AddToCart', standard: true },
  'Solicitudes Crédito': { eventName: 'AddPaymentInfo', standard: true },
  'Solicitudes Aprobadas': { eventName: 'CreditoAprobado', standard: false },
  'Cierre': { eventName: 'Purchase', standard: true },
  'Perdido': { eventName: 'LeadPerdido', standard: false },
};

/** Devuelve el mapeo de Meta para una etapa, o null si no debe enviarse. */
export function metaEventForStage(stageName: string | undefined): MetaEventMapping | null {
  if (!stageName) return null;
  return STAGE_EVENT_MAP[stageName] ?? null;
}
