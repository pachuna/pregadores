/**
 * Script para exportar todos os dados do Firestore para JSON local
 * Uso: node tmp_firestore_export.mjs
 * Requer: npm install firebase-admin (temporário)
 */

import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Projeto Firebase
const PROJECT_ID = 'territorios-utinga';

initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID,
});

const db = getFirestore();

async function exportCollection(colRef, depth = 0) {
  const snapshot = await colRef.get();
  const result = {};

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Converter Timestamps do Firestore para ISO string
    const serialized = serializeData(data);

    // Buscar subcoleções
    const subcollections = await doc.ref.listCollections();
    const subcols = {};
    for (const subcol of subcollections) {
      subcols[subcol.id] = await exportCollection(subcol, depth + 1);
    }

    result[doc.id] = {
      _id: doc.id,
      ...serialized,
      ...(Object.keys(subcols).length > 0 ? { _subcollections: subcols } : {}),
    };
  }

  return result;
}

function serializeData(data) {
  if (data === null || data === undefined) return data;

  if (typeof data === 'object' && data.constructor?.name === 'Timestamp') {
    return data.toDate().toISOString();
  }

  if (data instanceof Date) {
    return data.toISOString();
  }

  if (Array.isArray(data)) {
    return data.map(serializeData);
  }

  if (typeof data === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(data)) {
      out[k] = serializeData(v);
    }
    return out;
  }

  return data;
}

async function main() {
  console.log(`Conectando ao projeto: ${PROJECT_ID}`);

  const outputDir = './firestore-backup-local';
  mkdirSync(outputDir, { recursive: true });

  // Listar todas as coleções raiz
  const rootCollections = await db.listCollections();
  console.log(`\nColeções encontradas: ${rootCollections.map(c => c.id).join(', ')}`);

  const fullExport = {};

  for (const col of rootCollections) {
    console.log(`\nExportando coleção: ${col.id}...`);
    const data = await exportCollection(col);
    fullExport[col.id] = data;

    // Salvar cada coleção em arquivo separado
    const filePath = join(outputDir, `${col.id}.json`);
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`  ✔ Salvo: ${filePath} (${Object.keys(data).length} documentos)`);
  }

  // Salvar export completo
  const fullPath = join(outputDir, '_all_collections.json');
  writeFileSync(fullPath, JSON.stringify(fullExport, null, 2), 'utf-8');

  console.log(`\n✔ Export completo salvo em: ${fullPath}`);
  console.log('\n=== RESUMO DA ESTRUTURA ===');
  for (const [col, docs] of Object.entries(fullExport)) {
    const sample = Object.values(docs)[0];
    const fields = sample ? Object.keys(sample).filter(k => !k.startsWith('_')).join(', ') : 'vazio';
    console.log(`\n📁 ${col} (${Object.keys(docs).length} docs)`);
    console.log(`   Campos: ${fields}`);
    if (sample?._subcollections) {
      console.log(`   Subcoleções: ${Object.keys(sample._subcollections).join(', ')}`);
    }
  }
}

main().catch(err => {
  console.error('Erro:', err.message);
  if (err.message.includes('credential')) {
    console.error('\nDica: Execute primeiro:');
    console.error('  gcloud auth application-default login');
    console.error('  ou configure GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json');
  }
  process.exit(1);
});
