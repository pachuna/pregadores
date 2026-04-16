import { NextResponse } from "next/server";

export const revalidate = 86400; // cache 24h no servidor

export async function GET() {
  try {
    const res = await fetch(
      "https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome",
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) throw new Error(`IBGE ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600" },
    });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar estados." }, { status: 502 });
  }
}
