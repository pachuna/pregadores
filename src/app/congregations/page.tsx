"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import AuthGuard from "@/components/AuthGuard";
import CongregationRequestForm from "@/components/CongregationRequestForm";
import {
  congregationsApi,
  territoriesApi,
  type Congregation,
  type CongregationMember,
  type TerritoryListItem,
} from "@/lib/api";
import MobileBottomNav from "@/components/MobileBottomNav";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  ANCIAO: "Ancião",
  PUBLICADOR: "Publicador",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Aguardando aprovação", color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  ACTIVE: { label: "Ativa", color: "text-green-700 bg-green-50 border-green-200" },
  BLOCKED: { label: "Bloqueada", color: "text-red-700 bg-red-50 border-red-200" },
  REJECTED: { label: "Recusada", color: "text-gray-600 bg-gray-100 border-gray-300" },
};

function MemberCard({
  member,
  currentRole,
  congregationId,
  onUpdate,
}: {
  member: CongregationMember;
  currentRole: string;
  congregationId: string;
  onUpdate: () => void;
}) {
  // ADMIN pode gerenciar qualquer membro; ANCIAO apenas Publicadores
  const canShowActions =
    currentRole === "ADMIN" || (currentRole === "ANCIAO" && member.role !== "ANCIAO");
  const [loading, setLoading] = useState(false);

  const toggleBlock = async () => {
    setLoading(true);
    try {
      await congregationsApi.updateMember(congregationId, {
        userId: member.id,
        isBlocked: !member.isBlocked,
      });
      onUpdate();
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Remover ${member.email} da congregação?`)) return;
    setLoading(true);
    try {
      await congregationsApi.removeMember(congregationId, member.id);
      onUpdate();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="card py-3 px-4"
      style={{
        borderColor: member.isBlocked ? "var(--color-danger)" : "var(--color-border)",
        opacity: member.isBlocked ? 0.75 : 1,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--color-text)] truncate">{member.email}</p>
          <p className="text-xs text-[var(--color-text-light)] mt-0.5">
            {ROLE_LABELS[member.role]} · {member._count.revisits} revisitas
            {member.isBlocked && (
              <span className="ml-2 font-semibold text-red-600">BLOQUEADO</span>
            )}
          </p>
        </div>
        {canShowActions && (
          <div className="flex gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleBlock}
              disabled={loading}
              className="btn-secondary text-xs py-1 px-2"
              style={
                member.isBlocked
                  ? { color: "var(--color-success, #16a34a)" }
                  : { color: "var(--color-warning, #b45309)" }
              }
            >
              {member.isBlocked ? "Desbloquear" : "Bloquear"}
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={loading}
              className="btn-secondary text-xs py-1 px-2"
              style={{ color: "var(--color-danger)" }}
              aria-label="Remover membro"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden="true">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Territory Card ────────────────────────────────────────────────────────────

function TerritoryCard({ territory }: { territory: TerritoryListItem }) {
  const pct = territory.totalHouses > 0 ? 0 : 0; // preenchido com dados reais abaixo

  function formatDate(iso: string | null) {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  }

  return (
    <Link
      href={`/congregations/territories/${territory.id}`}
      className="block rounded-2xl overflow-hidden transition-transform active:scale-[0.98]"
      style={{
        background: "var(--color-surface-card)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-soft)",
      }}>
      {/* Imagem do território */}
      <div className="relative w-full bg-black/30" style={{ aspectRatio: "16/9" }}>
        <img
          src={`/territorios/${territory.number}.png`}
          alt={`Território ${territory.number}`}
          className="w-full h-full object-contain"
          loading="lazy"
        />
        {/* Badge número */}
        <div
          className="absolute top-2 left-2 min-w-[32px] h-7 rounded-full flex items-center justify-center px-2 text-xs font-bold text-white shadow"
          style={{ background: territory.color || "var(--color-primary)" }}>
          {territory.number}
        </div>
        {territory.hidden && (
          <div className="absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ background: "rgba(0,0,0,0.6)", color: "#fbbf24" }}>
            Oculto
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-sm font-semibold text-[var(--color-text)]">
            Território {territory.number}
          </p>
          <p className="text-xs text-[var(--color-text-light)] shrink-0">
            {territory.totalStreets} ruas · {territory.totalHouses} casas
          </p>
        </div>

        {territory.lastVisitAt ? (
          <p className="text-xs text-[var(--color-text-light)]">
            Última visita: {formatDate(territory.lastVisitAt)}
          </p>
        ) : (
          <p className="text-xs" style={{ color: "var(--color-text-light)", opacity: 0.6 }}>
            Sem visitas registradas
          </p>
        )}
      </div>
    </Link>
  );
}

// ── Territories Tab ───────────────────────────────────────────────────────────

function TerritoriesTab({ congregationId }: { congregationId: string }) {
  const [territories, setTerritories] = useState<TerritoryListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    territoriesApi.list()
      .then(({ data }) => setTerritories(data))
      .catch(() => setTerritories([]))
      .finally(() => setLoading(false));
  }, [congregationId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-7 h-7 rounded-full border-2 animate-spin"
          style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (territories.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
          style={{ background: "var(--color-primary-soft)" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5"
            className="w-7 h-7" aria-hidden="true">
            <path d="M3 6.5L8.5 4L15.5 6.5L21 4V17.5L15.5 20L8.5 17.5L3 20V6.5Z" />
            <path d="M8.5 4V17.5" /><path d="M15.5 6.5V20" />
          </svg>
        </div>
        <p className="text-sm text-[var(--color-text-light)]">Nenhum território cadastrado.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-[var(--color-text-light)] mb-3">
        {territories.length} territórios — toque para ver ruas e casas
      </p>
      <div className="grid grid-cols-2 gap-3">
        {territories.map((t) => (
          <TerritoryCard key={t.id} territory={t} />
        ))}
      </div>
    </div>
  );
}

// ── Main Content ──────────────────────────────────────────────────────────────

function CongregationContent() {
  const role = useAuthStore((s) => s.role);
  const congregationId = useAuthStore((s) => s.congregationId);
  const [congregation, setCongregation] = useState<Congregation | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [tab, setTab] = useState<"publicadores" | "territorios">("publicadores");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // ADMIN vinculado a uma congregação: busca diretamente pelo id
      if (role === "ADMIN" && congregationId) {
        const { data: detail } = await congregationsApi.getById(congregationId);
        setCongregation(detail);
        return;
      }

      const { data } = await congregationsApi.getMine();
      if (Array.isArray(data)) {
        setCongregation(null);
      } else if (data && "id" in data) {
        const cong = data as Congregation;
        if (cong.status === "ACTIVE" || cong.status === "BLOCKED") {
          const { data: detail } = await congregationsApi.getById(cong.id);
          setCongregation(detail);
        } else {
          setCongregation(cong);
        }
      } else {
        setCongregation(null);
      }
    } catch {
      setCongregation(null);
    } finally {
      setLoading(false);
    }
  }, [role, congregationId]);

  useEffect(() => { load(); }, [load]);

  const handleRequestSuccess = () => {
    setShowForm(false);
    setSuccessMsg("Solicitação enviada! O administrador será notificado e realizará a aprovação em breve.");
    load();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }} />
        <p className="text-sm text-[var(--color-text-light)]">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="mobile-page min-h-screen pb-24">
      {/* Header */}
      <div className="px-4 pt-10 pb-5"
        style={{ background: "linear-gradient(145deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)" }}>
        <h1 className="text-2xl font-bold text-white">Minha Congregação</h1>
        <p className="text-white/70 text-sm mt-1">
          {congregation ? congregation.name : "Nenhuma congregação vinculada"}
        </p>
      </div>

      <div className="px-4 pt-4">
        {successMsg && (
          <div className="rounded-xl p-3 mb-4 text-sm text-center"
            style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>
            {successMsg}
          </div>
        )}

        {/* Sem congregação — ADMIN não vinculado */}
        {!congregation && role === "ADMIN" && (
          <div className="card text-center py-8">
            <p className="text-sm text-[var(--color-text-light)]">
              Você não está vinculado a nenhuma congregação.{"\n"}
              Acesse o painel Admin para gerenciar congregações.
            </p>
          </div>
        )}

        {/* Sem congregação */}
        {!congregation && role === "ANCIAO" && !showForm && (
          <div className="card text-center py-8">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "var(--color-primary-soft)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                className="w-7 h-7" style={{ color: "var(--color-primary)" }} aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h2 className="font-semibold text-[var(--color-text)] mb-2">Sem congregação vinculada</h2>
            <p className="text-sm text-[var(--color-text-light)] mb-5 leading-relaxed">
              Você ainda não está vinculado a uma congregação.{"\n"}Solicite o cadastro.
            </p>
            <button type="button" onClick={() => setShowForm(true)} className="btn-primary w-full max-w-xs mx-auto">
              Solicitar cadastro de congregação
            </button>
          </div>
        )}

        {!congregation && role === "PUBLICADOR" && (
          <div className="card text-center py-8">
            <p className="text-sm text-[var(--color-text-light)]">
              Você ainda não foi vinculado a uma congregação.{"\n"}
              Aguarde o Ancião vincular seu acesso.
            </p>
          </div>
        )}

        {showForm && (
          <div className="card mb-4">
            <h2 className="font-semibold text-[var(--color-text)] mb-4">Solicitar cadastro de congregação</h2>
            <CongregationRequestForm onSuccess={handleRequestSuccess} onCancel={() => setShowForm(false)} />
          </div>
        )}

        {congregation && !showForm && (
          <>
            {/* Info card */}
            <div className="card mb-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-[var(--color-text)]">{congregation.name}</h2>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_LABELS[congregation.status]?.color}`}>
                  {STATUS_LABELS[congregation.status]?.label}
                </span>
              </div>
              <div className="text-sm text-[var(--color-text-light)] flex flex-col gap-1">
                <span>{congregation.city} — {congregation.state}</span>
                <span>{congregation.jwEmail}</span>
                {congregation._count && <span>{congregation._count.members} membro(s)</span>}
              </div>
              {congregation.status === "REJECTED" && congregation.rejectionReason && (
                <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-xs font-semibold text-red-700 mb-1">Motivo da recusa:</p>
                  <p className="text-sm text-red-700">{congregation.rejectionReason}</p>
                </div>
              )}
              {congregation.status === "REJECTED" && (
                <button type="button" onClick={() => setShowForm(true)} className="btn-primary w-full mt-4">
                  Enviar nova solicitação
                </button>
              )}
            </div>

            {congregation.status === "ACTIVE" && (
              <>
                {/* Abas */}
                <div className="flex rounded-xl overflow-hidden mb-4"
                  style={{ background: "var(--color-surface-card)", border: "1px solid var(--color-border)" }}>
                  {(["publicadores", "territorios"] as const).map((t) => {
                    const label = t === "publicadores" ? "Publicadores" : "Territórios";
                    const icon = t === "publicadores"
                      ? <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      : <><path d="M3 6.5L8.5 4L15.5 6.5L21 4V17.5L15.5 20L8.5 17.5L3 20V6.5Z" /><path d="M8.5 4V17.5" /><path d="M15.5 6.5V20" /></>;
                    const isActive = tab === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTab(t)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-all"
                        style={{
                          background: isActive ? "var(--color-primary)" : "transparent",
                          color: isActive ? "#fff" : "var(--color-text-light)",
                        }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                          className="w-4 h-4" aria-hidden="true">
                          {t === "publicadores"
                            ? <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>
                            : <><path d="M3 6.5L8.5 4L15.5 6.5L21 4V17.5L15.5 20L8.5 17.5L3 20V6.5Z" /><path d="M8.5 4V17.5" /><path d="M15.5 6.5V20" /></>}
                        </svg>
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Conteúdo da aba */}
                {tab === "publicadores" && (
                  <div>
                    {congregation.members && congregation.members.length === 0 ? (
                      <p className="text-sm text-[var(--color-text-light)] text-center py-6">
                        Nenhum membro vinculado ainda.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {congregation.members?.map((member) => (
                          <MemberCard
                            key={member.id}
                            member={member}
                            currentRole={role ?? ""}
                            congregationId={congregation.id}
                            onUpdate={load}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {tab === "territorios" && (
                  <TerritoriesTab congregationId={congregation.id} />
                )}
              </>
            )}

            {congregation.status === "PENDING" && (
              <p className="text-sm text-[var(--color-text-light)] text-center py-4">
                Sua congregação está aguardando aprovação do administrador.
              </p>
            )}
          </>
        )}
      </div>
      <MobileBottomNav />
    </div>
  );
}

export default function CongregationsPage() {
  return (
    <AuthGuard>
      <CongregationContent />
    </AuthGuard>
  );
}
