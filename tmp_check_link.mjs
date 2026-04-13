import { PrismaClient } from './src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { existsSync } from 'fs';

config({ path: '.env' });
if (existsSync('.env.local')) config({ path: '.env.local', override: true });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL }, { schema: 'public' });
const prisma = new PrismaClient({ adapter });

const result = await prisma.$queryRaw`
  SELECT c.name AS congregacao, COUNT(t.id)::int AS territorios
  FROM "Territory" t
  JOIN "Congregation" c ON c.id = t."congregationId"
  GROUP BY c.name
`;

console.log('\nVínculo Congregação → Territórios:');
console.table(result);
await prisma.$disconnect();
