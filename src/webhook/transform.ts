import { config } from '../config';
import { GatherLeadsDealValue, GatherLeadsEvent } from '../types';
import { brandFromLicenseId, resolveStageById } from '../mappings/stages';
import {
  DEAL_CREATED_EVENT,
  MetaEventMapping,
  TYPIFICATION_EVENT,
  metaEventForStage,
} from '../mappings/eventMap';
import { hashEmail, hashExternalId, hashName, hashPhone } from '../meta/hash';
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

  return ud;
}

function removeUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
}

/**
 * Decide qué evento de Meta corresponde a un evento de GatherLeads.
 *  - deal.created                         -> Lead
 *  - deal.updated + lastStageCC           -> evento mapeado por etapa
 *  - deal.updated + typification          -> evento de cualificación
 *  - resto (consentimiento, CRM, etc.)    -> ignorado
 */
function decideMapping(event: GatherLeadsEvent): { mapping: MetaEventMapping | null; stageName?: string; reason: string } {
  const updated = event.changes?.updatedFields ?? {};

  if (event.eventType === 'deal.created') {
    return { mapping: DEAL_CREATED_EVENT, reason: 'deal.created -> Lead' };
  }

  if (event.eventType === 'deal.updated') {
    if (updated.lastStageCC) {
      const stage = resolveStageById(updated.lastStageCC);
      if (!stage) {
        return { mapping: null, reason: `stageId desconocido (${updated.lastStageCC})` };
      }
      const mapping = metaEventForStage(stage.stage);
      return {
        mapping,
        stageName: stage.stage,
        reason: mapping
          ? `avance de etapa "${stage.stage}" -> ${mapping.eventName}`
          : `etapa "${stage.stage}" sin mapeo de Meta`,
      };
    }

    if (updated.typification) {
      return {
        mapping: TYPIFICATION_EVENT,
        reason: TYPIFICATION_EVENT
          ? `tipificación (${updated.typification}) -> ${TYPIFICATION_EVENT.eventName}`
          : 'tipificación sin evento configurado',
      };
    }

    return { mapping: null, reason: 'deal.updated automático (consentimiento/CRM) — ignorado' };
  }

  return { mapping: null, reason: `eventType no soportado (${event.eventType})` };
}

export function transform(event: GatherLeadsEvent): TransformResult {
  const { mapping, stageName, reason } = decideMapping(event);
  if (!mapping) {
    return { event: null, reason };
  }

  const deal = snapshot(event);
  const licenseId = event.metadata?.licenseId;
  const brand = brandFromLicenseId(licenseId) ?? brandFromLicenseId(deal.lastPipelineCC) ?? 'desconocida';

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
    funnel_stage: stageName ?? currentStage?.stage,
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

  // Meta exige currency + value en eventos Purchase. El payload de GatherLeads
  // no trae monto de venta, así que usamos los valores por defecto configurables
  // (META_DEFAULT_PURCHASE_VALUE / META_DEFAULT_CURRENCY). Si en el futuro se
  // quiere optimizar por valor, basta con configurar un ticket promedio.
  if (mapping.requiresValue) {
    customData.value = config.meta.defaultPurchaseValue;
    customData.currency = config.meta.defaultCurrency;
  }

  const metaEvent: MetaServerEvent = {
    event_name: mapping.eventName,
    event_time: Math.floor((event.timestamp ?? Date.now()) / 1000),
    action_source: ACTION_SOURCE,
    event_id: event.eventId,
    user_data: userData,
    custom_data: customData,
  };

  return { event: metaEvent, reason };
}
