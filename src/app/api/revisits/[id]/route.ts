import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth-middleware";

function toDateOrNow(value?: string): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

function toHistoryEntry(date: Date, summary: string): string {
  const dateLabel = date.toISOString().slice(0, 10);
  return `[${dateLabel}] ${summary.trim()}`;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const { id } = await params;

  try {
    const body = await request.json();
    const {
      name,
      address,
      latitude,
      longitude,
      isActive,
      newVisitDate,
      newVisitSummary,
    } = body ?? {};

    const revisit = await prisma.revisit.findFirst({
      where: { id, userId },
    });

    if (!revisit) {
      return NextResponse.json({ error: "Revisita não encontrada" }, { status: 404 });
    }

    const updateData: {
      name?: string;
      address?: string;
      latitude?: number;
      longitude?: number;
      isActive?: boolean;
      visitDate?: Date;
      notes?: string | null;
    } = {};

    if (typeof name === "string" && name.trim()) {
      updateData.name = name.trim();
    }

    if (typeof address === "string" && address.trim()) {
      updateData.address = address.trim();
    }

    if (typeof latitude === "number" && Number.isFinite(latitude)) {
      updateData.latitude = latitude;
    }

    if (typeof longitude === "number" && Number.isFinite(longitude)) {
      updateData.longitude = longitude;
    }

    if (typeof isActive === "boolean") {
      updateData.isActive = isActive;
    }

    if (typeof newVisitSummary === "string" && newVisitSummary.trim()) {
      const visitDate = toDateOrNow(newVisitDate);
      const historyEntry = toHistoryEntry(visitDate, newVisitSummary);
      const existingNotes = revisit.notes?.trim();

      updateData.visitDate = visitDate;
      updateData.notes = existingNotes
        ? `${existingNotes}\n${historyEntry}`
        : historyEntry;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "Nenhuma alteração informada" },
        { status: 400 },
      );
    }

    const updated = await prisma.revisit.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
