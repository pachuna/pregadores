"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  congregationsApi,
  adminApi,
  type Congregation,
  type AdminUser,
} from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import AuthGuard from "@/components/AuthGuard";
import MobileBottomNav from "@/components/MobileBottomNav";
import { useIBGEStates, useIBGECities } from "@/lib/ibge";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700 border-yellow-200",
  ACTIVE: "bg-green-100 text-green-700 border-green-200",
  BLOCKED: "bg-red-100 text-red-700 border-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  ACTIVE: "Ativa",
  BLOCKED: "Bloqueada",
};

interface LinkElderModalProps {
  congregation: Congregation;
  onClose: () => void;
  onLinked: () => void;
}

function LinkElderModal({ congregation, onClose, onLinked }: LinkElderModalProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi
      .listUsers()
      .then(({ data }) =>
        // Somente Anciãos e Publicadores sem congregação
        setUsers(
          data.filter(
            (u) => u.role !== "ADMIN" && !u.congregationId && !u.isBlocked
          )
        )
      )
      .catch(() => setError("Erro ao carregar usuários."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const linkUser = async (user: AdminUser) => {
    setLinking(true);
    setError("");
    try {
      // 1. Aprovar congregação (se ainda PENDING)
      if (congregation.status === "PENDING") {
        await congregationsApi.update(congregation.id, { status: "ACTIVE" });
      }
      // 2. Vincular usuário como ANCIAO + congregationId
      await congregationsApi.addMember(congregation.id, user.id, "ANCIAO");
      onLinked();
    } catch (err: unknown) {
      const msg =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { error?: string } } }).response?.data
          ?.error === "string"
          ? (err as { response: { data: { error: string } } }).response.data.error
          : "Erro ao vincular. Tente novamente.";
      setError(msg);
    } finally {
      setLinking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card w-full max-w-md max-h-[80vh] flex flex-col">
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-1">
          Vincular Primeiro Ancião
        </h2>
        <p className="text-sm text-[var(--color-text-light)] mb-4 truncate">
          {congregation.name} — {congregation.city}/{congregation.state}
        </p>

        <input
          type="text"
          placeholder="Buscar por email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input mb-3"
        />

        {error && (
          <p className="text-sm text-[var(--color-danger)] mb-3 text-center">{error}</p>
        )}

        <div className="overflow-y-auto flex-1 flex flex-col gap-2">
          {loading ? (
            <p className="text-sm text-[var(--color-text-light)] text-center py-6">
              Carregando usuários...
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-[var(--color-text-light)] text-center py-6">
              Nenhum usuário disponível encontrado.
            </p>
          ) : (
            filtered.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border"
                style={{ borderColor: "var(--color-border)" }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)] truncate">
                    {u.email}
                  </p>
                  <p className="text-xs text-[var(--color-text-light)] mt-0.5">
                    {u.role}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => linkUser(u)}
                  disabled={linking}
                  className="btn-primary text-xs py-1.5 px-3 shrink-0"
                >
                  {linking ? "..." : "Vincular"}
                </button>
              </div>
            ))
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="btn-secondary mt-4"
          disabled={linking}
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

// ── Modal Criar Congregação ────────────────────────────────────────────────

interface CreateCongregationModalProps {
  onClose: () => void;
  onCreated: (c: Congregation) => void;
}

function CreateCongregationModal({ onClose, onCreated }: CreateCongregationModalProps) {
  const [name, setName] = useState("");
  const [jwEmail, setJwEmail] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { states, loading: statesLoading } = useIBGEStates();
  const { cities, loading: citiesLoading } = useIBGECities(selectedState);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !jwEmail.trim() || !selectedState || !selectedCity) {
      setError("Preencha todos os campos.");
      return;
    }
    setSaving(true);
    try {
      const { data } = await congregationsApi.create({
        name: name.trim(),
        jwEmail: jwEmail.trim().toLowerCase(),
        state: selectedState,
        city: selectedCity,
      });
      onCreated(data);
    } catch (err: unknown) {
      const msg =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { error?: string } } }).response?.data?.error === "string"
          ? (err as { response: { data: { error: string } } }).response.data.error
          : "Erro ao criar congregação. Tente novamente.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-1">
          Criar Congregação
        </h2>
        <p className="text-sm text-[var(--color-text-light)] mb-5">
          Congregação criada pelo admin fica ativa imediatamente.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="cong-name" className="input-label">Nome da congregação</label>
            <input
              id="cong-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input mt-1"
              placeholder="Ex: Congregação Central"
              required
            />
          </div>

          <div>
            <label htmlFor="cong-email" className="input-label">E-mail JW</label>
            <input
              id="cong-email"
              type="email"
              value={jwEmail}
              onChange={(e) => setJwEmail(e.target.value)}
              className="input mt-1"
              placeholder="congregacao@jw.org"
              required
            />
          </div>

          <div>
            <label htmlFor="cong-state" className="input-label">Estado</label>
            <select
              id="cong-state"
              value={selectedState}
              onChange={(e) => { setSelectedState(e.target.value); setSelectedCity(""); }}
              className="input mt-1"
              required
              disabled={statesLoading}
            >
              <option value="">{statesLoading ? "Carregando..." : "Selecione o estado"}</option>
              {states.map((s) => (
                <option key={s.sigla} value={s.sigla}>{s.nome} ({s.sigla})</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="cong-city" className="input-label">Cidade</label>
            <select
              id="cong-city"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="input mt-1"
              required
              disabled={!selectedState || citiesLoading}
            >
              <option value="">
                {!selectedState ? "Selecione o estado primeiro" : citiesLoading ? "Carregando..." : "Selecione a cidade"}
              </option>
              {cities.map((c) => (
                <option key={c.id} value={c.nome}>{c.nome}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm text-[var(--color-danger)] text-center">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1" disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? "Criando..." : "Criar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminCongregationsContent() {
  const role = useAuthStore((s) => s.role);
  const router = useRouter();
  const [congregations, setCongregations] = useState<Congregation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [linkTarget, setLinkTarget] = useState<Congregation | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (role && role !== "ADMIN") router.replace("/home");
  }, [role, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await congregationsApi.list();
      setCongregations(Array.isArray(data) ? data : []);
    } catch {
      setError("Não foi possível carregar as congregações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async (
    congregation: Congregation,
    status: "ACTIVE" | "BLOCKED" | "PENDING"
  ) => {
    try {
      await congregationsApi.update(congregation.id, { status });
      setCongregations((prev) =>
        prev.map((c) => (c.id === congregation.id ? { ...c, status } : c))
      );
    } catch {
      setError("Erro ao atualizar status.");
    }
  };

  const pendingCount = congregations.filter((c) => c.status === "PENDING").length;

  if (role && role !== "ADMIN") return null;

  return (
    <div className="mobile-page min-h-screen pb-24">
      {/* Header */}
      <div
        className="px-4 pt-10 pb-6"
        style={{
          background:
            "linear-gradient(145deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)",
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 text-white/80 hover:text-white text-sm mb-4 transition-colors"
          aria-label="Voltar"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Voltar
        </button>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Congregações</h1>
            {pendingCount > 0 && (
              <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-white/20 hover:bg-white/30 transition-colors rounded-xl px-3 py-2"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nova
          </button>
        </div>
        <p className="text-white/70 text-sm mt-1">
          {congregations.length} congregação{congregations.length !== 1 ? "s" : ""} cadastrada{congregations.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="px-4 pt-5">
        {error && (
          <div
            className="rounded-xl p-3 mb-4 text-sm text-center"
            style={{ background: "#fef2f2", color: "var(--color-danger)", border: "1px solid #fecaca" }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div
              className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
            />
          </div>
        ) : congregations.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[var(--color-text-light)]">Nenhuma congregação cadastrada.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Pendentes primeiro */}
            {["PENDING", "ACTIVE", "BLOCKED"].map((statusGroup) => {
              const group = congregations.filter((c) => c.status === statusGroup);
              if (group.length === 0) return null;
              return (
                <div key={statusGroup}>
                  <h3 className="text-xs font-semibold text-[var(--color-text-light)] uppercase tracking-wide mb-2">
                    {STATUS_LABELS[statusGroup]}
                  </h3>
                  <div className="flex flex-col gap-3">
                    {group.map((c) => (
                      <div
                        key={c.id}
                        className="card"
                        style={{
                          borderColor:
                            c.status === "PENDING"
                              ? "#fcd34d"
                              : c.status === "BLOCKED"
                              ? "var(--color-danger)"
                              : "var(--color-border)",
                        }}
                      >
                        {/* Top row */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--color-text)] text-sm truncate">
                              {c.name}
                            </p>
                            <p className="text-xs text-[var(--color-text-light)] mt-0.5">
                              {c.city} — {c.state}
                            </p>
                            <p className="text-xs text-[var(--color-text-light)]">{c.jwEmail}</p>
                          </div>
                          <span
                            className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[c.status]}`}
                          >
                            {STATUS_LABELS[c.status]}
                          </span>
                        </div>

                        {/* Meta */}
                        <p className="text-xs text-[var(--color-text-light)] mb-3">
                          {c._count?.members ?? 0} membro(s) · Solicitado por{" "}
                          {c.createdBy?.email ?? "—"}
                        </p>

                        {/* Actions */}
                        <div className="flex gap-2 flex-wrap">
                          {c.status === "PENDING" && (
                            <button
                              type="button"
                              onClick={() => setLinkTarget(c)}
                              className="btn-primary text-xs py-1.5 px-3 flex-1"
                            >
                              Aprovar e vincular Ancião
                            </button>
                          )}

                          {c.status === "ACTIVE" && (
                            <>
                              <button
                                type="button"
                                onClick={() => setLinkTarget(c)}
                                className="btn-secondary text-xs py-1.5 px-3 flex-1"
                              >
                                Vincular Ancião
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(c, "BLOCKED")}
                                className="btn-secondary text-xs py-1.5 px-3"
                                style={{ color: "var(--color-danger)" }}
                              >
                                Bloquear
                              </button>
                            </>
                          )}

                          {c.status === "BLOCKED" && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(c, "ACTIVE")}
                              className="btn-secondary text-xs py-1.5 px-3 flex-1"
                              style={{ color: "var(--color-success, #16a34a)" }}
                            >
                              Reativar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal vincular Ancião */}
      {linkTarget && (
        <LinkElderModal
          congregation={linkTarget}
          onClose={() => setLinkTarget(null)}
          onLinked={() => {
            setLinkTarget(null);
            load();
          }}
        />
      )}

      {/* Modal criar congregação */}
      {showCreate && (
        <CreateCongregationModal
          onClose={() => setShowCreate(false)}
          onCreated={(newCong) => {
            setCongregations((prev) => [newCong, ...prev]);
            setShowCreate(false);
          }}
        />
      )}
      <MobileBottomNav />
    </div>
  );
}

export default function AdminCongregationsPage() {
  return (
    <AuthGuard>
      <AdminCongregationsContent />
    </AuthGuard>
  );
}
