/**
 * Entrypoint serverless para Vercel.
 *
 * Exportamos un handler EXPLÍCITO que delega en la app de Express, en lugar de
 * exportar la instancia de Express directamente. El runtime de Vercel valida
 * que el default export sea una función handler; exportar la app cruda puede
 * provocar "Invalid export ... must be a function or server" en arranque frío.
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../src/app';

const app = createApp();

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
