import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRefreshToken } from "@/lib/jwt";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken : "";

    if (!refreshToken) {
      return NextResponse.json({ error: "Refresh token é obrigatório" }, { status: 400 });
    }

    const payload = await verifyRefreshToken(refreshToken);
    if (!payload?.sub) {
      return NextResponse.json({ ok: true });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, refreshTokenVersion: true },
    });

    if (!user || (payload.ver ?? -1) !== user.refreshTokenVersion) {
      return NextResponse.json({ ok: true });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenVersion: { increment: 1 } },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}