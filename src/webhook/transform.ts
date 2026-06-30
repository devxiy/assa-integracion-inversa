import { config } from '../config';
import { GatherLeadsDealValue, GatherLeadsEvent } from '../types';
import { brandFromLicenseId, resolveStageById } from '../mappings/stages';
import {
  CREATED_FALLBACK_LABEL,
  TYPIFICATION_LABEL,
  buildEventName,
  stageRequiresValue,
} from '../mappings/eventMap';
import { hashCountry, hashEmail, hashExternalId, hashName, hashPhone } from '../meta/hash';
import { MetaServerEvent, MetaUserData } from '../meta/capi';

const ACTION_SOURCE = 'system_generated';

export interface TransformResult {
  /** Evento listo para enviar a Meta, o null si debe ignorarse. */
  event: MetaServerEvent | null;
  /** Motivo legible para logs (qué se decidió y por qué). */
  reason: string;
}

/** Combina oldValue + newValue para tener el estado más completo del deal. */
function snapshot(event: GatherLeadsEvent): GatherLeadsDealValue {
  const changes = event.changes ?? {};
  return { ...(changes.oldValue ?? {}), ...(changes.newValue ?? {}) };
}

function buildUserData(deal: GatherLeadsDealValue, contactId?: string): MetaUserData {
  const ud: MetaUserData = {};
  const em = hashEmail(deal.email);
  const ph = hashPhone(deal.phone);
  const fn = hashName(deal.firstName);
  const ln = hashName(deal.lastName);

  if (em) ud.em = [em];
  if (ph) ud.ph = [ph];
  if (fn) ud.fn = [fn];
  if (ln) ud.ln = [ln];

  const externalIds: string[] = [];
  const idHash = hashExternalId(deal.identification);
  const contactHash = hashExternalId(contactId);
  if (idHash) externalIds.push(idHash);
  if (contactHash) externalIds.push(contactHash);
  if (externalIds.length) ud.external_id = externalIds;

  // País por defecto (ASSA opera en Ecuador) para mejorar el match quality.
  const country = hashCountry(config.meta.defaultCountry);
  if (country) ud.country = [country];

  return ud;
}

function removeUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
}

/** Un Meta lead_id es un entero de 15-17 dígitos. */
const LEAD_ID_RE = /^\d{15,17}$/;
/** Nombres de campo habituales donde un CRM guarda el leadgen_id de Meta. */
const LEAD_ID_KEYS = [
  'leadgenId',
  'leadGenId',
  'leadgen_id',
  'metaLeadId',
  'fbLeadId',
  'facebookLeadId',
  'leadId',
  'adLeadId',
];
/** Campos que nunca son lead_id (evita falsos positivos en la autodetección). */
const LEAD_ID_SKIP_KEYS = new Set(['phone', 'identification', 'correlationId']);

/**
 * Extrae el Meta leadgen_id del deal SOLO si viene en el payload de GatherLeads.
 *  1) Usa el campo configurado en GATHERLEADS_LEAD_ID_FIELD si existe.
 *  2) Si no, revisa nombres de campo habituales.
 *  3) Como último recurso, autodetecta cualquier valor de 15-17 dígitos.
 * Devuelve undefined si no hay un candidato válido (lead no proveniente de Meta).
 */
function extractLeadId(deal: GatherLeadsDealValue): string | undefined {
  const isLeadId = (v: unknown): v is string | number =>
    (typeof v === 'string' || typeof v === 'number') && LEAD_ID_RE.test(String(v));

  const configured = config.gatherleads.leadIdField;
  if (configured && isLeadId(deal[configured])) return String(deal[configured]);

  for (const key of LEAD_ID_KEYS) {
    if (isLeadId(deal[key])) return String(deal[key]);
  }

  for (const [k, v] of Object.entries(deal)) {
    if (LEAD_ID_SKIP_KEYS.has(k)) continue;
    if (isLeadId(v)) return String(v);
  }

  return undefined;
}

interface StageDecision {
  /** Etiqueta a usar en el nombre del evento: etapa real, 'Lead' o 'LeadCualificado'. */
  label: string | null;
  /** Nombre de la etapa real del funnel, si aplica (para value/currency y custom_data). */
  stageName?: string;
  /** Motivo legible para logs. */
  reason: string;
}

/**
 * Decide qué etiqueta (etapa) representa el evento de GatherLeads. El nombre
 * final del evento se arma como `{Marca}_{etiqueta}` en transform().
 *  - deal.created                  -> etapa actual del deal (o 'Lead' si no resuelve)
 *  - deal.updated + lastStageCC    -> nueva etapa del funnel
 *  - deal.updated + typification   -> 'LeadCualificado'
 *  - resto (consentimiento, CRM)   -> ignorado
 */
function decideStage(event: GatherLeadsEvent, deal: GatherLeadsDealValue): StageDecision {
  const updated = event.changes?.updatedFields ?? {};

  if (event.eventType === 'deal.created') {
    const stage = resolveStageById(deal.lastStageCC);
    if (stage) {
      return { label: stage.stage, stageName: stage.stage, reason: `deal.created en etapa "${stage.stage}"` };
    }
    return { label: CREATED_FALLBACK_LABEL, reason: 'deal.created sin etapa resoluble -> Lead' };
  }

  if (event.eventType === 'deal.updated') {
    if (updated.lastStageCC) {
      const stage = resolveStageById(updated.lastStageCC);
      if (!stage) {
        return { label: null, reason: `stageId desconocido (${updated.lastStageCC})` };
      }
      return { label: stage.stage, stageName: stage.stage, reason: `avance a etapa "${stage.stage}"` };
    }

    if (updated.typification && TYPIFICATION_LABEL) {
      return { label: TYPIFICATION_LABEL, reason: `tipificación (${updated.typification}) -> ${TYPIFICATION_LABEL}` };
    }

    return { label: null, reason: 'deal.updated automático (consentimiento/CRM) — ignorado' };
  }

  return { label: null, reason: `eventType no soportado (${event.eventType})` };
}

export function transform(event: GatherLeadsEvent): TransformResult {
  const deal = snapshot(event);
  const decision = decideStage(event, deal);
  if (!decision.label) {
    return { event: null, reason: decision.reason };
  }

  const licenseId = event.metadata?.licenseId;
  const brand = brandFromLicenseId(licenseId) ?? brandFromLicenseId(deal.lastPipelineCC) ?? 'desconocida';

  // Nombre del evento: Marca + Etapa (ej. ChevroletPesados_Cotizacion).
  const eventName = buildEventName(brand, decision.label);

  // La etapa actual del deal (aunque el evento no la haya cambiado).
  const currentStage = resolveStageById(deal.lastStageCC);

  const userData = buildUserData(deal, event.metadata?.contactId);

  const customData = removeUndefined({
    // Diferencial de marca dentro de un único pixel.
    brand,
    license_id: licenseId,
    content_category: brand,
    // Contexto del funnel.
    pipeline: currentStage?.pipeline,
    funnel_stage: decision.stageName ?? currentStage?.stage ?? decision.label,
    event_label: decision.label,
    // Atributos comerciales del lead.
    product: deal.product,
    agency: deal.agency,
    agency_name: deal.agencyName,
    channel: deal.channel,
    source: deal.source,
    origin: deal.origin,
    lead_type: deal.type,
    lead_status: deal.status,
    temperature: deal.temperature,
    lead_qualification: deal.leadQualification,
    typification: deal.typification,
    gatherleads_resource_id: event.resourceId,
  });

  // En la etapa de cierre incluimos value + currency (optimización por valor).
  // El payload de GatherLeads no trae monto, así que usamos los valores por
  // defecto configurables (META_DEFAULT_PURCHASE_VALUE / META_DEFAULT_CURRENCY).
  if (stageRequiresValue(decision.stageName)) {
    customData.value = config.meta.defaultPurchaseValue;
    customData.currency = config.meta.defaultCurrency;
  }

  // Conversions API for CRM: TODOS los eventos vienen de CarConnect (el CRM),
  // así que se marcan como CRM (event_source + lead_event_source). Cuando el
  // lead trae el leadgen_id de Meta (vino de un Meta Lead Ad) se agrega además
  // user_data.lead_id (numérico, sin hashear) para un match más fuerte; el resto
  // hace match por email/teléfono hasheados.
  customData.event_source = 'crm';
  customData.lead_event_source = config.meta.leadEventSource;

  const leadId = extractLeadId(deal);
  if (leadId) {
    userData.lead_id = Number(leadId);
  }

  const metaEvent: MetaServerEvent = {
    event_name: eventName,
    event_time: Math.floor((event.timestamp ?? Date.now()) / 1000),
    action_source: ACTION_SOURCE,
    event_id: event.eventId,
    user_data: userData,
    custom_data: customData,
  };

  return { event: metaEvent, reason: decision.reason };
}
