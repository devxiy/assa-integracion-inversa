# ASSA · Integración GatherLeads → Meta Conversions API

Integración que recibe los **webhooks de GatherLeads (CarConnect)** y reenvía
los leads a **Meta Conversions API (CAPI)** según su **etapa en el funnel de
compra**, diferenciados por **marca**, todo bajo un **único Pixel**.

La marca **no** genera un pixel distinto: viaja como diferencial dentro de
`custom_data` (`brand`, `license_id`, `content_category`), de modo que en Meta
Events Manager / Ads Manager puedes segmentar por marca sin multiplicar pixeles.

---

## Cómo funciona

```
GatherLeads  ──POST webhook──▶  este servicio  ──Conversions API──▶  Meta (1 Pixel)
 deal.created                   - valida firma                       event_name = etapa
 deal.updated                   - deduplica (eventId)                custom_data.brand = marca
                                - mapea etapa → evento Meta
                                - hashea datos de usuario (SHA-256)
```

1. **Marca** → se obtiene de `metadata.licenseId` (ej. `hfNHQm-AU-VO` = VW Livianos).
2. **Etapa del funnel** → se obtiene de `lastStageCC` y se resuelve contra el
   catálogo de pipelines/etapas extraído de la documentación oficial
   (`src/data/stages.json`, 14 marcas × 2 pipelines × etapas).
3. **Evento de Meta** → se determina por la etapa (`src/mappings/eventMap.ts`).

### Mapeo etapa → evento de Meta (editable)

| Pipeline        | Etapa GatherLeads      | Evento Meta        |
|-----------------|------------------------|--------------------|
| Contact Center  | Prospección Bruta      | _(ignorado)_       |
| Contact Center  | Base Prospección       | _(ignorado)_       |
| Contact Center  | Gestión                | `Contact`          |
| Contact Center  | Prospección            | _(ignorado)_       |
| Contact Center  | Cita                   | `Schedule`         |
| Contact Center  | Cita Confirmada        | `CitaConfirmada`   |
| Ventas          | Tráfico                | `VisitaShowroom`   |
| Ventas          | Test Drive             | `TestDrive`        |
| Ventas          | Cotización             | `InitiateCheckout` |
| Ventas          | Reservas               | `AddToCart`        |
| Ventas          | Solicitudes Crédito    | `AddPaymentInfo`   |
| Ventas          | Solicitudes Aprobadas  | `CreditoAprobado`  |
| Ventas          | Cierre                 | `Purchase`         |
| Ventas          | Perdido                | `LeadPerdido`      |

Además: `deal.created` → `Lead`, y la tipificación del asesor → `LeadCualificado`.
Ajusta estos valores libremente en `src/mappings/eventMap.ts` (`null` = no enviar).

---

## Requisitos / Credenciales

### De Meta (necesarias para el envío automático)

Configúralas en `.env` (copia desde `.env.example`):

| Variable                 | Qué es / dónde se obtiene |
|--------------------------|---------------------------|
| `META_PIXEL_ID`          | **Pixel ID** (Dataset ID) del Pixel único. Events Manager → tu Pixel → Configuración. |
| `META_ACCESS_TOKEN`      | **Token de la Conversions API**. Events Manager → tu Pixel → Configuración → Conversions API → *Generar token de acceso*. |
| `META_GRAPH_API_VERSION` | Versión del Graph API. Por defecto `v21.0`. |
| `META_TEST_EVENT_CODE`   | _(Opcional)_ Código de la pestaña *Probar eventos* para validar antes de producción. Vaciar en prod. |

### De GatherLeads

| Variable                       | Qué es |
|--------------------------------|--------|
| `GATHERLEADS_SECRET`           | Secret Key que se acuerda con GatherLeads al crear el webhook. |
| `GATHERLEADS_SIGNATURE_HEADER` | Header donde llega la firma (**a confirmar con su equipo**). |
| `GATHERLEADS_VERIFY_SIGNATURE` | `false` hasta confirmar el algoritmo de firma con GatherLeads. |

> ⚠️ La documentación de GatherLeads indica que el **header y el algoritmo de
> firma exactos deben confirmarse con su equipo**. La implementación actual
> asume HMAC-SHA256 sobre el body crudo; ajusta `src/webhook/signature.ts` si
> usan otro esquema.

---

## Puesta en marcha

```bash
cp .env.example .env     # y completa las credenciales de Meta
npm install
npm run build
npm start                # producción
# o
npm run dev              # desarrollo con recarga
```

Endpoints:

- `POST /webhook/gatherleads` — receptor del webhook de GatherLeads.
- `GET /health` — healthcheck (`metaConfigured`, nº de marcas).
- `GET /mappings` — marcas conocidas y el mapeo etapa → evento (útil para QA).

### Registro del webhook en GatherLeads

En `console.gatherleads.io/integrations/crm/webhook`:

1. **URL**: `https://TU-DOMINIO/webhook/gatherleads` (debe ser **HTTPS público**).
2. **Secret Key**: la misma de `GATHERLEADS_SECRET`.
3. **Eventos**: suscríbete a **Negocio → Creación** y **Negocio → Actualización**.

### Despliegue en Vercel

El proyecto ya está listo para Vercel (modelo serverless). `api/index.ts` expone
la misma app de Express y `vercel.json` enruta todo hacia esa función.

1. Sube el repo a GitHub/GitLab e **importa el proyecto en Vercel**.
   - **Framework Preset:** *Other*.
   - **Build Command:** déjalo vacío (Vercel compila `api/` automáticamente).
   - **Output Directory:** déjalo vacío.
2. En **Settings → Environment Variables** carga las mismas variables del
   `.env` (`META_PIXEL_ID`, `META_ACCESS_TOKEN`, `META_GRAPH_API_VERSION`,
   `META_TEST_EVENT_CODE`, `GATHERLEADS_SECRET`, etc.). No subas `.env` al repo.
3. Tras el deploy, tu endpoint será:
   `https://TU-PROYECTO.vercel.app/webhook/gatherleads`
   (registra esa URL en GatherLeads). También tendrás `/health` y `/mappings`.

O por CLI:

```bash
npm i -g vercel
vercel            # primer deploy (preview)
vercel --prod     # producción
```

> ⚠️ **Idempotencia en serverless:** la deduplicación por `eventId` es en memoria
> y **no persiste** entre invocaciones/instancias en Vercel. Meta ya deduplica
> por `event_id`, así que sigue siendo seguro; pero si quieres deduplicación
> propia robusta, conecta **Vercel KV / Upstash Redis** reemplazando la función
> `seen()` en `src/webhook/idempotency.ts`.

### Pruebas antes de producción

1. Pon un `META_TEST_EVENT_CODE` en `.env`.
2. Expón el servicio (ngrok, Cloudflare Tunnel, o un deploy de staging).
3. Genera un lead de prueba en GatherLeads (o usa `node scripts/smoke.js`).
4. Verifica los eventos en Events Manager → *Probar eventos*.

---

## Detalles de implementación

- **Idempotencia** por `eventId` (`src/webhook/idempotency.ts`, en memoria;
  cambiar por Redis para multi-instancia).
- **Advanced Matching**: email, teléfono, nombre, apellido e identificación se
  envían hasheados con **SHA-256** (`src/meta/hash.ts`), como exige Meta.
- **`action_source`**: `system_generated` (los eventos provienen del CRM, no de
  navegación web).
- **Reintentos**: ante error transitorio de Meta se responde `502` para que
  GatherLeads reintente; los eventos deliberadamente no enviados responden `200`.
- **Catálogo de etapas**: `npm run extract:stages` regenera
  `src/data/stages.json` desde la documentación HTML si esta cambia.

## Estructura

```
api/
  index.ts                 entrypoint serverless para Vercel (exporta la app)
vercel.json                enruta todo el tráfico hacia /api
src/
  app.ts                   construye la app de Express (rutas)
  index.ts                 arranque local/Docker (app.listen)
  config.ts                lectura de .env
  logger.ts                logging estructurado
  types.ts                 tipos del payload de GatherLeads
  data/stages.json         catálogo marca/pipeline/etapa (generado)
  mappings/
    stages.ts              licenseId→marca, stageId→etapa
    eventMap.ts            etapa→evento de Meta (EDITABLE)
  meta/
    hash.ts                hashing SHA-256 (Advanced Matching)
    capi.ts                cliente Conversions API
  webhook/
    signature.ts           verificación de firma
    idempotency.ts         deduplicación por eventId
    transform.ts           GatherLeads → evento de Meta
    handler.ts             orquestación del request
scripts/
  extract-stages.js        regenera data/stages.json desde la doc
  smoke.js                 prueba de transformación con ejemplos de la doc
```
