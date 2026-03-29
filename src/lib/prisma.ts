import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import path from "path";

function createAdapter() {
  const dbUrl = process.env.DATABASE_URL?.trim();

  if (dbUrl?.startsWith("postgresql://") || dbUrl?.startsWith("postgres://")) {
    return new PrismaPg({ connectionString: dbUrl });
  }

  if (dbUrl?.startsWith("file:")) {
    const sqlitePath = dbUrl.slice("file:".length);
    const resolvedSqlitePath = path.isAbsolute(sqlitePath)
      ? sqlitePath
      : path.resolve(process.cwd(), sqlitePath);

    return new PrismaBetterSqlite3({ url: resolvedSqlitePath });
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL inválida em produção. Use postgres://... ou file:/caminho/absoluto.db"
    );
  }

  const fallbackDevDbPath = path.resolve(process.cwd(), "prisma", "dev.db");
  return new PrismaBetterSqlite3({ url: fallbackDevDbPath });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter: createAdapter() });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
