import stagesData from '../data/stages.json';
import { StageRecord } from '../types';

const RECORDS = stagesData as StageRecord[];

/** stageId (lastStageCC) -> registro completo (marca, pipeline, etapa). */
const byStageId = new Map<string, StageRecord>();
/** pipelineId (lastPipelineCC) -> registros de ese pipeline. */
const byPipelineId = new Map<string, StageRecord[]>();
/** licenseId -> nombre legible de la marca. */
const brandByLicense = new Map<string, string>();

for (const rec of RECORDS) {
  byStageId.set(rec.sid, rec);
  if (!byPipelineId.has(rec.pid)) byPipelineId.set(rec.pid, []);
  byPipelineId.get(rec.pid)!.push(rec);
  if (!brandByLicense.has(rec.lid)) brandByLicense.set(rec.lid, rec.lic);
}

export interface ResolvedStage {
  brand: string;
  licenseId: string;
  pipeline: string;
  pipelineId: string;
  stage: string;
  stageId: string;
}

/** Resuelve una etapa a partir del stageId (lastStageCC). */
export function resolveStageById(stageId: string | undefined): ResolvedStage | null {
  if (!stageId) return null;
  const rec = byStageId.get(stageId);
  if (!rec) return null;
  return {
    brand: rec.lic,
    licenseId: rec.lid,
    pipeline: rec.pipeline,
    pipelineId: rec.pid,
    stage: rec.stage,
    stageId: rec.sid,
  };
}

/** Nombre de marca a partir del licenseId. */
export function brandFromLicenseId(licenseId: string | undefined): string | undefined {
  if (!licenseId) return undefined;
  return brandByLicense.get(licenseId);
}

/** Lista de todas las marcas (licencias) conocidas. */
export function listBrands(): { licenseId: string; brand: string }[] {
  return Array.from(brandByLicense.entries()).map(([licenseId, brand]) => ({ licenseId, brand }));
}
