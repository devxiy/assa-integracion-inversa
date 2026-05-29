/**
 * Entrypoint serverless para Vercel.
 *
 * Vercel enruta todas las peticiones a esta función (ver vercel.json) y la
 * app de Express resuelve las rutas internas (/webhook/gatherleads, /health,
 * /mappings). No se llama a listen(): Vercel invoca la app como handler.
 */
import { createApp } from '../src/app';

const app = createApp();

export default app;
