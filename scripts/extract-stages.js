/**
 * Extrae el arreglo STAGES_DATA embebido en la documentación HTML de
 * GatherLeads y lo guarda como src/data/stages.json.
 *
 * Uso: npm run extract:stages
 *
 * Esto mantiene el mapeo marca + pipeline + etapa como única fuente de
 * verdad tomada directamente de la documentación oficial.
 */
const fs = require('fs');
const path = require('path');

const DOC_FILE = path.join(__dirname, '..', 'gatherleads-webhook-docs .html');
const OUT_FILE = path.join(__dirname, '..', 'src', 'data', 'stages.json');

function main() {
  if (!fs.existsSync(DOC_FILE)) {
    console.error(`No se encontró la documentación: ${DOC_FILE}`);
    process.exit(1);
  }

  const html = fs.readFileSync(DOC_FILE, 'utf8');
  const marker = 'const STAGES_DATA = ';
  const start = html.indexOf(marker);
  if (start === -1) {
    console.error('No se encontró "const STAGES_DATA =" en la documentación.');
    process.exit(1);
  }

  const arrStart = html.indexOf('[', start);
  const arrEnd = html.indexOf('];', arrStart);
  if (arrStart === -1 || arrEnd === -1) {
    console.error('No se pudo delimitar el arreglo STAGES_DATA.');
    process.exit(1);
  }

  const jsonText = html.slice(arrStart, arrEnd + 1);
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch (err) {
    console.error('No se pudo parsear STAGES_DATA como JSON:', err.message);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');

  const brands = new Set(data.map((r) => r.lid));
  console.log(`OK — ${data.length} etapas, ${brands.size} licencias (marcas).`);
  console.log(`Escrito en ${OUT_FILE}`);
}

main();
