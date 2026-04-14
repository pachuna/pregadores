import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireTerritoryManager } from "@/lib/auth-middleware";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * POST /api/territories/[id]/image
 * Faz upload da imagem do território (multipart/form-data, campo "file").
 * Restrito a ADMIN, ANCIAO e SERVO_DE_CAMPO.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTerritoryManager(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  // Verifica propriedade do território
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { congregationId: true },
  });

  const territory = await prisma.territory.findUnique({
    where: { id },
    select: { id: true, congregationId: true },
  });

  if (!territory) {
    return NextResponse.json({ error: "Território não encontrado." }, { status: 404 });
  }

  if (territory.congregationId !== user?.congregationId && auth.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Tipo de arquivo inválido. Use PNG, JPEG ou WEBP." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande. Máximo 5 MB." }, { status: 400 });
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const filename = `${id}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "territorios");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), buffer);

  const imageUrl = `/territorios/${filename}`;
  await prisma.territory.update({
    where: { id },
    data: { imageUrl },
  });

  return NextResponse.json({ imageUrl });
}
