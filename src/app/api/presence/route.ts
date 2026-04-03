import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth-middleware";

export async function POST(request: NextRequest) {
  const result = await authenticateRequest(request);
  if (result instanceof NextResponse) return result;
  const userId = result;

  await prisma.user.update({
    where: { id: userId },
    data: { lastSeenAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
