/**
 * Script de seed: promove o email do ADMIN_EMAIL para role ADMIN.
 * Execute: npx tsx prisma/seed-admin.ts
 */
import * as dotenv from "dotenv";
import { resolve } from "path";
import { PrismaClient } from "../src/generated/prisma/client.js";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) {
    console.error("ADMIN_EMAIL não definido. Defina no .env.local");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!user) {
    console.log(`Usuário ${adminEmail} não encontrado no banco. Nenhuma alteração feita.`);
    process.exit(0);
  }

  if (user.role === "ADMIN") {
    console.log(`${adminEmail} já é ADMIN.`);
    process.exit(0);
  }

  await prisma.user.update({
    where: { email: adminEmail },
    data: { role: "ADMIN" },
  });

  console.log(`✅ ${adminEmail} promovido para ADMIN com sucesso.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
