import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-middleware";

/**
 * GET /api/admin/users — Lista todos os usuários (admins only)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const page = Math.max(Number(searchParams.get("page") ?? "1") || 1, 1);
  const pageSize = Math.min(
    Math.max(Number(searchParams.get("pageSize") ?? "20") || 20, 1),
    100
  );
  const search = (searchParams.get("search") ?? "").trim();
  const skip = (page - 1) * pageSize;

  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: "insensitive" as const } },
          { name: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const [users, total, adminCount, anciaoCount, publicadorCount, servoCount] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        congregationId: true,
        isBlocked: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { revisits: true } },
      },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    }),
    prisma.user.count({ where }),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { role: "ANCIAO" } }),
    prisma.user.count({ where: { role: "PUBLICADOR" } }),
    prisma.user.count({ where: { role: "SERVO_DE_CAMPO" } }),
  ]);

  const counts = {
    ADMIN: adminCount,
    ANCIAO: anciaoCount,
    PUBLICADOR: publicadorCount,
    SERVO_DE_CAMPO: servoCount,
  };

  return NextResponse.json({
    items: users,
    total,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
    counts,
  });
}
