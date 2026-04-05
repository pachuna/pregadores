import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-middleware";

/**
 * GET /api/admin/users — Lista todos os usuários (admins only)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      congregationId: true,
      isBlocked: true,
      lastSeenAt: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { revisits: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(users);
}
