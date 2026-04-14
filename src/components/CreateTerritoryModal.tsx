"use client";

import { useCallback, useRef, useState } from "react";
import { territoriesApi } from "@/lib/api";

// ─────────────────────────────────────────────────────────────────────────────

interface StreetResult {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

interface AddedStreet {
  tempId: string;
  name: string;
  houses: string[]; // números das casas
}

// ─────────────────────────────────────────────────────────────────────────────

const COLORS = [
  "#4a6da7", "#c18f59", "#16a34a", "#dc2626",
  "#9333ea", "#0891b2", "#ea580c", "#65a30d",
];

// ─────────────────────────────────────────────────────────────────────────────

export default function CreateTerritoryModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  // Step 1: label + color + type
  const [step, setStep] = useState<1 | 2>(1);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [type, setType] = useState<"IMAGE" | "STREETS">("STREETS");

  // Step 2 — IMAGE
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2 — STREETS
  const [streets, setStreets] = useState<AddedStreet[]>([]);
  const [streetQuery, setStreetQuery] = useState("");
  const [streetResults, setStreetResults] = useState<StreetResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchDebounce, setSearchDebounce] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [activeStreetIdx, setActiveStreetIdx] = useState<number | null>(null); // qual rua está expandida para editar casas
  const [houseInput, setHouseInput] = useState("");

  // Submissão
  const [saving, setSaving] = useState(false);
  const [savingStep, setSavingStep] = useState<"creating" | "streets" | "map" | null>(null);
  const [generatedMapUrl, setGeneratedMapUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function handleStreetQueryChange(q: string) {
    setStreetQuery(q);
    setStreetResults([]);
    if (searchDebounce) clearTimeout(searchDebounce);
    if (q.trim().length < 3) return;
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { data } = await territoriesApi.searchStreets(q.trim());
        setStreetResults(data.results);
      } catch {
        setStreetResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 450);
    setSearchDebounce(t);
  }

  function handleSelectStreet(r: StreetResult) {
    const name = r.logradouro || r.bairro;
    if (!name) return;
    // Evita duplicatas
    if (streets.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      setStreetQuery("");
      setStreetResults([]);
      return;
    }
    setStreets((prev) => [
      ...prev,
      { tempId: crypto.randomUUID(), name, houses: [] },
    ]);
    setStreetQuery("");
    setStreetResults([]);
    setActiveStreetIdx(streets.length); // expande a nova rua
  }

  function handleAddManualStreet() {
    const name = streetQuery.trim();
    if (!name) return;
    if (streets.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      setStreetQuery("");
      return;
    }
    setStreets((prev) => [
      ...prev,
      { tempId: crypto.randomUUID(), name, houses: [] },
    ]);
    setStreetQuery("");
    setStreetResults([]);
    setActiveStreetIdx(streets.length);
  }

  function handleAddHouse(streetIdx: number) {
    const nums = houseInput
      .split(/[\s,;]+/)
      .map((h) => h.trim())
      .filter((h) => h.length > 0);
    if (!nums.length) return;
    setStreets((prev) =>
      prev.map((s, i) =>
        i === streetIdx
          ? { ...s, houses: [...s.houses, ...nums.filter((n) => !s.houses.includes(n))] }
          : s
      )
    );
    setHouseInput("");
  }

  function handleRemoveHouse(streetIdx: number, houseNum: string) {
    setStreets((prev) =>
      prev.map((s, i) =>
        i === streetIdx ? { ...s, houses: s.houses.filter((h) => h !== houseNum) } : s
      )
    );
  }

  function handleRemoveStreet(streetIdx: number) {
    setStreets((prev) => prev.filter((_, i) => i !== streetIdx));
    if (activeStreetIdx === streetIdx) setActiveStreetIdx(null);
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    setError("");
    if (!label.trim()) {
      setError("O rótulo do território é obrigatório.");
      return;
    }

    setSaving(true);
    try {
      // 1. Cria o território
      setSavingStep("creating");
      const { data: created } = await territoriesApi.create({ label: label.trim(), color, territoryType: type });

      // 2a. Se IMAGE: faz upload da imagem (opcional)
      if (type === "IMAGE" && imageFile) {
        await territoriesApi.uploadImage(created.id, imageFile);
      }

      // 2b. Se STREETS: cria as ruas e depois gera o mapa automaticamente
      if (type === "STREETS" && streets.length > 0) {
        setSavingStep("streets");
        for (const s of streets) {
          if (s.name.trim()) {
            await territoriesApi.addStreet(created.id, { name: s.name, houses: s.houses });
          }
        }

        // Gera mapa a partir das ruas
        setSavingStep("map");
        try {
          const { data: mapData } = await territoriesApi.generateMap(created.id);
          setGeneratedMapUrl(mapData.imageUrl);
        } catch {
          // Se falhar geração, território foi salvo mas sem mapa
        }
      }

      onCreated();
    } catch {
      setError("Erro ao salvar o território. Tente novamente.");
    } finally {
      setSaving(false);
      setSavingStep(null);
    }
  }, [label, color, type, imageFile, streets, onCreated]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full md:max-w-lg rounded-t-3xl md:rounded-3xl overflow-y-auto"
        style={{
          maxHeight: "92dvh",
          background: "var(--color-surface-elevated)",
          border: "1px solid var(--color-border)",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--color-border)" }} />
        </div>

        <div className="px-5 pt-3 pb-8 flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[var(--color-text)]">
              {step === 1 ? "Novo Território" : type === "IMAGE" ? "Imagem do Território" : "Ruas do Território"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full"
              style={{ background: "var(--color-surface-card)" }}
              aria-label="Fechar"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className="w-4 h-4" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ── STEP 1 ────────────────────────────────────────────────── */}
          {step === 1 && (
            <>
              {/* Rótulo */}
              <div>
                <label className="text-xs font-semibold text-[var(--color-text-light)] uppercase tracking-wide mb-1.5 block">
                  Rótulo / Nome
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ex: 1, A, Norte, Centro..."
                  maxLength={30}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition"
                  style={{
                    background: "var(--color-surface-card)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                />
                <p className="text-xs text-[var(--color-text-light)] mt-1">
                  Pode ser número, letra ou nome. Fica visível nos cards.
                </p>
              </div>

              {/* Cor */}
              <div>
                <label className="text-xs font-semibold text-[var(--color-text-light)] uppercase tracking-wide mb-1.5 block">
                  Cor do território
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="w-9 h-9 rounded-full transition-transform"
                      style={{
                        background: c,
                        outline: color === c ? `3px solid ${c}` : "none",
                        outlineOffset: "2px",
                        transform: color === c ? "scale(1.15)" : "scale(1)",
                      }}
                      aria-label={`Cor ${c}`}
                    />
                  ))}
                  {/* Cor customizada */}
                  <label
                    className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-transform"
                    style={{
                      background: COLORS.includes(color) ? "var(--color-surface-card)" : color,
                      border: "1px dashed var(--color-border)",
                    }}
                    title="Cor personalizada"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      className="w-4 h-4" style={{ color: COLORS.includes(color) ? "var(--color-text-light)" : "#fff" }}
                      aria-hidden="true">
                      <path d="M12 2a10 10 0 1 0 10 10" /><path d="M15 3l6 6-3 3-6-6 3-3Z" />
                    </svg>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>

              {/* Tipo */}
              <div>
                <div className="grid grid-cols-2 gap-3">
                  {(["STREETS", "IMAGE"] as const).map((t) => {
                    const isActive = type === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className="flex flex-col items-center gap-2 rounded-2xl p-4 transition-all"
                        style={{
                          background: isActive ? "rgba(74,109,167,0.15)" : "var(--color-surface-card)",
                          border: `2px solid ${isActive ? "var(--color-primary)" : "var(--color-border)"}`,
                        }}
                      >
                        {t === "STREETS" ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                            className="w-7 h-7" style={{ color: isActive ? "var(--color-primary)" : "var(--color-text-light)" }}
                            aria-hidden="true">
                            <path d="M3 12h18M3 6h18M3 18h18" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                            className="w-7 h-7" style={{ color: isActive ? "var(--color-primary)" : "var(--color-text-light)" }}
                            aria-hidden="true">
                            <rect x="3" y="3" width="18" height="18" rx="3" />
                            <path d="M3 9l4-4 4 4 4-4 4 4" />
                            <circle cx="8.5" cy="14.5" r="1.5" />
                          </svg>
                        )}
                        <span
                          className="text-xs font-semibold"
                          style={{ color: isActive ? "var(--color-primary)" : "var(--color-text-light)" }}
                        >
                          {t === "STREETS" ? "Gerar Mapa Automaticamente" : "Subir Imagem do Mapa"}
                        </span>
                        <span className="text-xs text-center leading-tight" style={{ color: "var(--color-text-light)" }}>
                          {t === "STREETS"
                            ? "Cadastre as ruas e o mapa é gerado"
                            : "Faça upload de uma imagem"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={() => {
                  if (!label.trim()) { setError("O rótulo é obrigatório."); return; }
                  setError("");
                  setStep(2);
                }}
                className="btn-primary w-full py-3"
              >
                Próximo
              </button>
            </>
          )}

          {/* ── STEP 2 — IMAGE ───────────────────────────────────────── */}
          {step === 2 && type === "IMAGE" && (
            <>
              <p className="text-sm text-[var(--color-text-light)]">
                Selecione a imagem (PNG, JPG ou WEBP — máx 5 MB) que representa o território <strong style={{ color: "var(--color-text)" }}>{label}</strong>.
                Esta etapa é opcional — você pode adicionar a imagem depois.
              </p>

              {/* Upload área */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative w-full rounded-2xl overflow-hidden flex items-center justify-center transition-colors"
                style={{
                  aspectRatio: "16/9",
                  background: imagePreview ? "transparent" : "var(--color-surface-card)",
                  border: imagePreview ? "none" : "2px dashed var(--color-border)",
                }}
              >
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagePreview} alt="preview" className="w-full h-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-2 px-6 py-8">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                      className="w-10 h-10" style={{ color: "var(--color-text-light)" }} aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <p className="text-sm text-[var(--color-text-light)]">Toque para selecionar</p>
                  </div>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={handleImageSelect}
              />

              {imagePreview && (
                <button
                  type="button"
                  onClick={() => { setImageFile(null); setImagePreview(null); }}
                  className="text-xs text-[var(--color-text-light)] underline text-center"
                >
                  Trocar imagem
                </button>
              )}

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1 py-3">
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving}
                  className="btn-primary flex-1 py-3 disabled:opacity-50"
                >
                  {saving ? "Salvando..." : "Criar Território"}
                </button>
              </div>
            </>
          )}

          {/* ── STEP 2 — STREETS ─────────────────────────────────────── */}
          {step === 2 && type === "STREETS" && (
            <>
              <p className="text-sm text-[var(--color-text-light)]">
                Adicione as ruas do território <strong style={{ color: "var(--color-text)" }}>{label}</strong>. Para cada rua, informe os números das casas.
              </p>

              {/* Busca de rua */}
              <div className="relative">
                <label className="text-xs font-semibold text-[var(--color-text-light)] uppercase tracking-wide mb-1.5 block">
                  Buscar / Adicionar rua
                </label>
                <input
                  type="text"
                  value={streetQuery}
                  onChange={(e) => handleStreetQueryChange(e.target.value)}
                  placeholder="Digite o nome da rua..."
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{
                    background: "var(--color-surface-card)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                />

                {/* Resultados */}
                {(streetResults.length > 0 || (streetQuery.trim().length >= 3 && !searchLoading)) && (
                  <div
                    className="absolute left-0 right-0 top-full mt-1.5 rounded-2xl overflow-hidden z-10 shadow-lg"
                    style={{
                      background: "var(--color-surface-elevated)",
                      border: "1px solid var(--color-border)",
                      maxHeight: "220px",
                      overflowY: "auto",
                    }}
                  >
                    {searchLoading && (
                      <div className="px-4 py-3 text-xs text-[var(--color-text-light)]">Buscando...</div>
                    )}

                    {!searchLoading && streetResults.length === 0 && streetQuery.trim().length >= 3 && (
                      <button
                        type="button"
                        onClick={handleAddManualStreet}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-white/5 transition-colors"
                        style={{ color: "var(--color-primary)" }}
                      >
                        + Adicionar &quot;{streetQuery.trim()}&quot; manualmente
                      </button>
                    )}

                    {streetResults.map((r) => (
                      <button
                        key={r.cep}
                        type="button"
                        onClick={() => handleSelectStreet(r)}
                        className="w-full px-4 py-3 text-left hover:bg-white/5 transition-colors border-b last:border-b-0"
                        style={{ borderColor: "var(--color-border)" }}
                      >
                        <p className="text-sm text-[var(--color-text)] font-medium">{r.logradouro}</p>
                        <p className="text-xs text-[var(--color-text-light)] mt-0.5">{r.bairro} — CEP {r.cep}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Lista de ruas adicionadas */}
              {streets.length > 0 && (
                <div className="flex flex-col gap-2">
                  {streets.map((street, idx) => (
                    <div
                      key={street.tempId}
                      className="rounded-2xl overflow-hidden"
                      style={{
                        border: "1px solid var(--color-border)",
                        background: "var(--color-surface-card)",
                      }}
                    >
                      {/* Street header */}
                      <div className="flex items-center justify-between px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setActiveStreetIdx(activeStreetIdx === idx ? null : idx)}
                          className="flex items-center gap-2 text-left flex-1 min-w-0"
                        >
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: "var(--color-primary)" }}
                          />
                          <span className="text-sm font-medium text-[var(--color-text)] truncate">
                            {street.name}
                          </span>
                          <span className="text-xs text-[var(--color-text-light)] shrink-0">
                            {street.houses.length} casa(s)
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveStreet(idx)}
                          className="ml-2 shrink-0 w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-500/10"
                          aria-label="Remover rua"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                            className="w-3.5 h-3.5" style={{ color: "var(--color-danger)" }} aria-hidden="true">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Expandido: adicionar casas */}
                      {activeStreetIdx === idx && (
                        <div className="px-4 pb-3 flex flex-col gap-2"
                          style={{ borderTop: "1px solid var(--color-border)" }}>
                          <p className="text-xs text-[var(--color-text-light)] pt-2">
                            Números das casas (separe por vírgula ou espaço):
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={houseInput}
                              onChange={(e) => setHouseInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddHouse(idx); } }}
                              placeholder="Ex: 10, 12, 14A..."
                              className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                              style={{
                                background: "var(--color-surface-elevated)",
                                border: "1px solid var(--color-border)",
                                color: "var(--color-text)",
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleAddHouse(idx)}
                              className="btn-primary px-3 py-2 text-xs shrink-0"
                            >
                              Adicionar
                            </button>
                          </div>
                          {street.houses.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {street.houses.map((h) => (
                                <span
                                  key={h}
                                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                                  style={{ background: "rgba(74,109,167,0.15)", color: "var(--color-primary)" }}
                                >
                                  {h}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveHouse(idx, h)}
                                    aria-label={`Remover casa ${h}`}
                                  >
                                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
                                      className="w-3 h-3" aria-hidden="true">
                                      <path d="M4 4l8 8M12 4l-8 8" />
                                    </svg>
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {streets.length === 0 && (
                <div className="text-center py-2">
                  <p className="text-xs text-[var(--color-text-light)]">
                    Nenhuma rua adicionada. Você pode criar o território e adicionar ruas depois.
                  </p>
                </div>
              )}

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1 py-3"
                  disabled={saving}>
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving}
                  className="btn-primary flex-1 py-3 disabled:opacity-50"
                >
                  {saving
                    ? savingStep === "map"
                      ? "Gerando mapa..."
                      : savingStep === "streets"
                      ? "Salvando ruas..."
                      : "Criando..."
                    : "Criar Território"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
