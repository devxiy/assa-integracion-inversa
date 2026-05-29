/**
 * Idempotencia por eventId (requisito de la documentación de GatherLeads).
 *
 * Implementación en memoria con expiración. Para producción multi-instancia
 * se recomienda sustituir por Redis u otra store compartida implementando
 * la misma interfaz `seen()`.
 */

const TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
const MAX_ENTRIES = 100_000;

const store = new Map<string, number>();

function prune(now: number): void {
  if (store.size < MAX_ENTRIES) return;
  for (const [key, expiry] of store) {
    if (expiry <= now) store.delete(key);
  }
  // Si sigue lleno tras limpiar expirados, elimina los más antiguos.
  if (store.size >= MAX_ENTRIES) {
    const excess = store.size - MAX_ENTRIES + 1;
    let removed = 0;
    for (const key of store.keys()) {
      store.delete(key);
      if (++removed >= excess) break;
    }
  }
}

/**
 * Devuelve true si el eventId ya fue procesado (duplicado).
 * Si es nuevo, lo registra y devuelve false.
 */
export function seen(eventId: string): boolean {
  const now = Date.now();
  const expiry = store.get(eventId);
  if (expiry && expiry > now) return true;
  prune(now);
  store.set(eventId, now + TTL_MS);
  return false;
}
