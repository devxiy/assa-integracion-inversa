/**
 * Prueba de humo: corre los payloads de ejemplo de la documentación a través
 * del transformador y muestra el evento de Meta resultante.
 * Requiere compilar antes: npm run build && node scripts/smoke.js
 */
const { transform } = require('../dist/webhook/transform');

const dealCreated = {
  eventId: 'nX8vt1az5CSmuyUG7eG9FU',
  timestamp: 1778707706688,
  eventType: 'deal.created',
  resourceType: 'deal',
  resourceId: '6a04ecfa18bc541094f824db',
  changes: {
    newValue: {
      firstName: 'TEST1',
      lastName: 'MORAN VERA',
      email: 'testtest@hotmail.com',
      phone: '+593988999889',
      identification: '1724821887',
      channel: 'digital',
      source: 'web',
      origin: 'Página Web',
      product: 'M_C 100',
      agency: '001',
      agencyName: 'AMB ATAHUALPA',
      status: 'validated',
      type: 'new',
      isSalesPipeline: true,
      lastPipelineCC: 'q46SQsc5wyFRnSCxczD6qs',
      lastStageCC: '5VNG5NmmcDJZsRoUD6uQrk',
      createdAt: 1778707706307,
      updatedAt: 1778707706307,
    },
  },
  metadata: {
    licenseId: 'iEGaTL-AU-MA',
    ownerId: '682fd26ab55499faa70873bf',
    contactId: '6a04ecf9ebe76ead9114f978',
    originId: '9cR8gZ7yBdp4NAdRD8EgTb',
  },
};

// Avance de etapa Maxus Pesados: Prospección Bruta -> Perdido (sid del ejemplo).
const stageAdvance = {
  eventId: '4YKYcuNyh8QeQz1AXZyPmg',
  timestamp: 1778708721668,
  eventType: 'deal.updated',
  resourceId: '6a04ecfa18bc541094f824db',
  changes: {
    oldValue: { ...dealCreated.changes.newValue },
    newValue: { ...dealCreated.changes.newValue, lastStageCC: 'm2n2bKqnMGEAjqMVChbJrS' },
    updatedFields: { lastStageCC: 'm2n2bKqnMGEAjqMVChbJrS', updatedAt: 1778708721212 },
  },
  metadata: dealCreated.metadata,
};

// Avance a "Cierre" en Chevrolet Livianos (debe mapear a Purchase).
const cierreChevrolet = {
  eventId: 'test-cierre-chev',
  timestamp: 1778708721668,
  eventType: 'deal.updated',
  resourceId: 'abc',
  changes: {
    newValue: { firstName: 'Ana', email: 'ana@x.com', phone: '+593900000000' },
    updatedFields: { lastStageCC: 'd52xtXznYq3uR5RLZP1aSi', updatedAt: 1778708721212 },
  },
  metadata: { licenseId: 'fWQnYD-AU-CH', contactId: 'c1' },
};

// Consentimiento (automático) — debe ignorarse.
const consent = {
  eventId: 'fhK8yKab2ooUxHy2cshXSN',
  timestamp: 1778707706984,
  eventType: 'deal.updated',
  resourceId: '6a04ecfa18bc541094f824db',
  changes: { updatedFields: { updatedAt: 1778707706586, isDataConsentProcessActive: false } },
  metadata: dealCreated.metadata,
};

// Tipificación del asesor.
const tipificacion = {
  eventId: 'oFppL8U2W9pdwticedcL2C',
  timestamp: 1778707889208,
  eventType: 'deal.updated',
  resourceId: '6a04ecfa18bc541094f824db',
  changes: {
    newValue: { ...dealCreated.changes.newValue },
    updatedFields: { typification: 'C1_GESCONAGECIT', leadQualification: 'AAA', temperature: 'cold' },
  },
  metadata: dealCreated.metadata,
};

for (const [name, ev] of Object.entries({ dealCreated, stageAdvance, cierreChevrolet, consent, tipificacion })) {
  const out = transform(ev);
  console.log(`\n=== ${name} ===`);
  console.log('reason:', out.reason);
  console.log(JSON.stringify(out.event, null, 2));
}
