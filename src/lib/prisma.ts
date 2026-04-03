import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createAdapter() {
  const dbUrl = process.env.DATABASE_URL?.trim();

  if (dbUrl?.startsWith("postgresql://") || dbUrl?.startsWith("postgres://")) {
    return new PrismaPg({ connectionString: dbUrl }, { schema: "public" });
  }

  if (dbUrl?.startsWith("file:")) {
    throw new Error(
      "DATABASE_URL com file: nao e compativel com este projeto. Use postgres://...",
    );
  }

  if (!dbUrl) {
    throw new Error(
      "DATABASE_URL nao definida. Configure uma conexao PostgreSQL para iniciar a aplicacao.",
    );
  }

  throw new Error("DATABASE_URL invalida. Use postgres://... ou postgresql://...");
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter: createAdapter() });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
