import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth-middleware";

export async function GET(request: NextRequest) {
  const result = await authenticateRequest(request);
  if (result instanceof NextResponse) return result;
  const userId = result;

  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

  const [totalUsers, onlineUsers, totalRevisits, activeRevisits, inactiveRevisits] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { lastSeenAt: { gte: twoMinutesAgo } } }),
      prisma.revisit.count({ where: { userId } }),
      prisma.revisit.count({ where: { userId, isActive: true } }),
      prisma.revisit.count({ where: { userId, isActive: false } }),
    ]);

  return NextResponse.json({
    totalUsers,
    onlineUsers,
    totalRevisits,
    activeRevisits,
    inactiveRevisits,
  });
}
