import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import path from "path";

function createAdapter() {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl?.startsWith("postgresql://") || dbUrl?.startsWith("postgres://")) {
    return new PrismaPg({ connectionString: dbUrl });
  }

  const dbPath = path.resolve(process.cwd(), "dev.db");
  return new PrismaBetterSqlite3({ url: dbPath });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter: createAdapter() });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
