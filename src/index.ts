import { createApp } from './app';
import { config, metaIsConfigured } from './config';
import { logger } from './logger';

// Arranque para entorno tradicional (servidor propio, Docker, etc.).
// En Vercel se usa api/index.ts, que importa la misma app sin "listen".
const app = createApp();

app.listen(config.port, () => {
  logger.info(`Servidor escuchando en http://localhost:${config.port}`, {
    metaConfigured: metaIsConfigured(),
    verifySignature: config.gatherleads.verifySignature,
    testEventCode: Boolean(config.meta.testEventCode),
  });
});
