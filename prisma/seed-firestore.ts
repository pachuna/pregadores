/**
 * Script de migração: Firestore (territorios-utinga) → PostgreSQL/Prisma
 *
 * O que este script faz:
 *  1. Cria a Congregação "Utinga" (se não existir)
 *  2. Cria Users a partir de user_claims (email + flag admin → role)
 *  3. Cria Territory → Street → House → HouseVisit (lastStatus)
 *
 * Uso:
 *   npx ts-node --esm prisma/seed-firestore.ts
 *   ou: npx tsx prisma/seed-firestore.ts
 *
 * NUNCA apaga dados do Firebase. Operação somente de ESCRITA no Postgres.
 */

import { PrismaClient, Role, HouseVisitStatus } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import bcrypt from 'bcryptjs';
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';

// Carrega variáveis de ambiente igual ao prisma.config.ts
loadEnv({ path: '.env' });
if (existsSync('.env.local')) loadEnv({ path: '.env.local', override: true });
if (existsSync('.env.production')) loadEnv({ path: '.env.production', override: true });

const dbUrl = process.env.DATABASE_URL?.trim();
if (!dbUrl) throw new Error('DATABASE_URL não definida.');

const adapter = new PrismaPg({ connectionString: dbUrl }, { schema: 'public' });
const prisma = new PrismaClient({ adapter });

// ── Tipos locais ────────────────────────────────────────────────────────────

interface FirebaseStreet {
  id: string;
  name: string;
  lastUpdate?: string;
}

interface FirebaseHouseStatus {
  date: string;
  status: string;
  user_uid: string;
}

interface FirebaseHouse {
  id: string;
  number: string;
  observation?: string;
  phones?: string[];
  streetId: string;
  lastStatus?: FirebaseHouseStatus;
}

interface FirebaseTerritory {
  _id: string;
  number: number;
  color: string;
  hidden: boolean;
  lastUpdate?: string;
  streets: FirebaseStreet[];
  houses: FirebaseHouse[];
}

interface FirebaseUserClaim {
  _id: string;       // Firebase UID
  userEmail: string;
  admin?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function loadJson<T>(filename: string): T {
  const filePath = join(process.cwd(), 'firestore-backup-local', filename);
  return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
}

function normalizeStatus(s: string): HouseVisitStatus {
  return s === 'OK' ? HouseVisitStatus.OK : HouseVisitStatus.FAIL;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Iniciando migração Firestore → PostgreSQL ===\n');

  const territories = loadJson<Record<string, FirebaseTerritory>>('territories.json');
  const userClaims  = loadJson<Record<string, FirebaseUserClaim>>('user_claims.json');

  // ── 1. Usuários ─────────────────────────────────────────────────────────

  console.log('1/4 Criando usuários a partir de user_claims...');

  // Senha temporária para todos os usuários migrados
  const tempPasswordHash = await bcrypt.hash('Trocar@123', 12);

  const firebaseUidToUserId = new Map<string, string>();

  for (const [firebaseUid, claim] of Object.entries(userClaims)) {
    const email = claim.userEmail?.trim().toLowerCase();
    if (!email) continue;

    const role: Role = claim.admin ? Role.ADMIN : Role.PUBLICADOR;

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        firebaseUid,
        role,
      },
      create: {
        email,
        passwordHash: tempPasswordHash,
        firebaseUid,
        role,
      },
    });

    firebaseUidToUserId.set(firebaseUid, user.id);
  }

  console.log(`   ✔ ${Object.keys(userClaims).length} usuários processados\n`);

  // ── 2. Congregação ────────────────────────────────────────────────────────

  console.log('2/4 Criando congregação Utinga...');

  // Usa primeiro admin como criador
  const adminUser = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
  if (!adminUser) throw new Error('Nenhum usuário admin encontrado. Verifique user_claims.json.');

  const existing = await prisma.congregation.findFirst({
    where: { name: 'Congregação Utinga' },
  });

  const congregation = existing ?? await prisma.congregation.create({
    data: {
      name:        'Congregação Utinga',
      jwEmail:     'congregacao.utinga@jw.org',
      state:       'BA',
      city:        'Salvador',
      status:      'ACTIVE',
      createdById: adminUser.id,
    },
  });

  console.log(`   ✔ Congregação: ${congregation.name} (id: ${congregation.id})\n`);

  // Vincula todos os usuários a esta congregação (se ainda não têm)
  await prisma.user.updateMany({
    where: { congregationId: null },
    data:  { congregationId: congregation.id },
  });

  // ── 3. Territórios, Ruas, Casas ──────────────────────────────────────────

  console.log('3/4 Importando territórios, ruas e casas...');

  let countTerritories = 0, countStreets = 0, countHouses = 0, countVisits = 0;

  for (const territory of Object.values(territories)) {
    // Territory
    const dbTerritory = await prisma.territory.upsert({
      where: { number: territory.number },
      update: {
        color:         territory.color,
        hidden:        territory.hidden,
        lastUpdate:    territory.lastUpdate ? new Date(territory.lastUpdate) : null,
        congregationId: congregation.id,
      },
      create: {
        firebaseId:    territory._id,
        number:        territory.number,
        color:         territory.color,
        hidden:        territory.hidden,
        lastUpdate:    territory.lastUpdate ? new Date(territory.lastUpdate) : null,
        congregationId: congregation.id,
      },
    });
    countTerritories++;

    // Streets
    for (const street of territory.streets ?? []) {
      await prisma.street.upsert({
        where: { id: street.id },
        update: {
          name:       street.name,
          lastUpdate: street.lastUpdate ? new Date(street.lastUpdate) : null,
        },
        create: {
          id:          street.id,
          name:        street.name,
          lastUpdate:  street.lastUpdate ? new Date(street.lastUpdate) : null,
          territoryId: dbTerritory.id,
        },
      });
      countStreets++;
    }

    // Houses + HouseVisit (lastStatus)
    for (const house of territory.houses ?? []) {
      await prisma.house.upsert({
        where: { id: house.id },
        update: {
          number:      house.number,
          observation: house.observation ?? null,
          phones:      house.phones ?? [],
        },
        create: {
          id:          house.id,
          number:      house.number,
          observation: house.observation ?? null,
          phones:      house.phones ?? [],
          streetId:    house.streetId,
        },
      });
      countHouses++;

      // Última visita
      if (house.lastStatus) {
        const resolvedUserId = firebaseUidToUserId.get(house.lastStatus.user_uid) ?? null;

        // Verifica se já existe visita exatamente igual (idempotente)
        const existing = await prisma.houseVisit.findFirst({
          where: {
            houseId:   house.id,
            visitedAt: new Date(house.lastStatus.date),
          },
        });

        if (!existing) {
          await prisma.houseVisit.create({
            data: {
              houseId:         house.id,
              status:          normalizeStatus(house.lastStatus.status),
              visitedAt:       new Date(house.lastStatus.date),
              firebaseUserUid: house.lastStatus.user_uid,
              userId:          resolvedUserId,
            },
          });
          countVisits++;
        }
      }
    }

    process.stdout.write(`\r   Progresso: ${countTerritories}/${Object.keys(territories).length} territórios...`);
  }

  console.log(`\n   ✔ ${countTerritories} territórios | ${countStreets} ruas | ${countHouses} casas | ${countVisits} visitas\n`);

  // ── 4. Resumo final ───────────────────────────────────────────────────────

  console.log('4/4 Validação final...');

  const [users, terrs, streets, houses, visits] = await Promise.all([
    prisma.user.count(),
    prisma.territory.count(),
    prisma.street.count(),
    prisma.house.count(),
    prisma.houseVisit.count(),
  ]);

  console.log(`
=== Migração concluída com sucesso! ===

  Usuários    : ${users}
  Territórios : ${terrs}
  Ruas        : ${streets}
  Casas       : ${houses}
  Visitas     : ${visits}

ATENÇÃO: Todos os usuários migrados têm senha temporária: Trocar@123
         Oriente os usuários a alterarem a senha no primeiro acesso.
  `);
}

main()
  .catch((err) => {
    console.error('\nErro durante a migração:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
