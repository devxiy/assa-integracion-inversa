/**
 * Tipos del payload de webhook de GatherLeads (CarConnect).
 * Basado en la documentación oficial de Webhooks v1.0.
 *
 * Todos los campos de gestión son opcionales: solo aparecen una vez que el
 * asesor los completa manualmente, por lo que se validan antes de usar.
 */

export interface GatherLeadsIntegrationCrm {
  crmStatusCode?: number;
  /** Llega como string JSON serializado — parsear con JSON.parse antes de usar. */
  crmPayload?: string;
}

export interface GatherLeadsDealValue {
  firstName?: string;
  lastName?: string;
  email?: string;
  /** Teléfono en formato E.164. Ej: +593988999889 */
  phone?: string;
  /** Cédula / identificación. */
  identification?: string;

  channel?: string;
  source?: string;
  origin?: string;
  product?: string;
  agency?: string;
  agencyName?: string;

  status?: string;
  type?: string;
  isSalesPipeline?: boolean;
  isIntegrated?: boolean;
  isDataConsentProcessActive?: boolean;
  integrationCrm?: GatherLeadsIntegrationCrm;
  correlationId?: string;

  /** ID del pipeline actual en CarConnect. */
  lastPipelineCC?: string;
  /** ID de la etapa actual dentro del pipeline. */
  lastStageCC?: string;

  createdAt?: number;
  updatedAt?: number;
  historyCrmExecutionStatus?: unknown[];

  // Campos de gestión (tipificación del asesor) — opcionales.
  advisor?: string;
  cctAdvisor?: string;
  cctObservation?: string;
  typification?: string;
  contactability?: string;
  leadQualification?: string;
  temperature?: string;
  numberOfCalls?: string;
  appointmentTime?: string;
  appointmentConfirmation?: boolean;
  attendance?: boolean;
  civilStatus?: string;
  estimatedIncome?: string;
  estimatedPurchaseTime?: string;
  typeOfFinancing?: string;
  entrancePayment?: string;
  carAsPaymentMethod?: string;
  carLicense?: string;
  bureauRating?: string;
  bureauAcceptance?: boolean;

  [key: string]: unknown;
}

export interface GatherLeadsChanges {
  newValue?: GatherLeadsDealValue;
  oldValue?: GatherLeadsDealValue;
  updatedFields?: GatherLeadsDealValue;
}

export interface GatherLeadsMetadata {
  /** ID de la licencia que generó el evento. Identifica la MARCA. */
  licenseId?: string;
  ownerId?: string;
  contactId?: string;
  originId?: string;
}

export interface GatherLeadsEvent {
  /** Clave de idempotencia. */
  eventId: string;
  /** Unix timestamp en milisegundos. */
  timestamp: number;
  /** "deal.created" | "deal.updated" */
  eventType: string;
  resourceType?: string;
  /** ID del negocio en GatherLeads (estable entre eventos del mismo lead). */
  resourceId: string;
  changes?: GatherLeadsChanges;
  metadata?: GatherLeadsMetadata;
}

/** Entrada del mapa de pipelines/etapas extraído de la documentación. */
export interface StageRecord {
  /** Nombre legible de la licencia/marca. Ej: "VW Livianos". */
  lic: string;
  /** licenseId. Ej: "hfNHQm-AU-VO". */
  lid: string;
  /** "Contact Center" | "Ventas". */
  pipeline: string;
  /** pipelineId (lastPipelineCC). */
  pid: string;
  /** Nombre de la etapa. Ej: "Cita Confirmada". */
  stage: string;
  /** stageId (lastStageCC). */
  sid: string;
}
