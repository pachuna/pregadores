import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/auth-middleware";

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { lastSeenAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
