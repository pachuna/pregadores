"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import AuthGuard from "@/components/AuthGuard";
import CongregationRequestForm from "@/components/CongregationRequestForm";
import CreateTerritoryModal from "@/components/CreateTerritoryModal";
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
  SERVO_DE_CAMPO: "Servo de Campo",
};

const TERRITORY_MANAGER_ROLES = ["ADMIN", "ANCIAO", "SERVO_DE_CAMPO"];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Aguardando aprovação", color: "text-[#fbbf24] bg-[rgba(251,191,36,0.15)] border-[rgba(251,191,36,0.3)]" },
  ACTIVE: { label: "Ativa", color: "text-[#4ade80] bg-[rgba(34,197,94,0.15)] border-[rgba(34,197,94,0.3)]" },
  BLOCKED: { label: "Bloqueada", color: "text-[#f87171] bg-[rgba(239,68,68,0.15)] border-[rgba(239,68,68,0.3)]" },
  REJECTED: { label: "Recusada", color: "text-[#94a3b8] bg-[rgba(255,255,255,0.06)] border-[rgba(255,255,255,0.12)]" },
};

// Roles que ANCIAO pode atribuir (tudo exceto ADMIN)
const EDITABLE_ROLES_ANCIAO: CongregationMember["role"][] = ["ANCIAO", "PUBLICADOR", "SERVO_DE_CAMPO"];
// ADMIN pode atribuir qualquer role (exceto ADMIN, que é gerenciado fora deste fluxo)
const EDITABLE_ROLES_ADMIN: CongregationMember["role"][] = ["ANCIAO", "PUBLICADOR", "SERVO_DE_CAMPO"];

function EditMemberModal({
  member,
  currentRole,
  congregationId,
  onClose,
  onSaved,
}: {
  member: CongregationMember;
  currentRole: string;
  congregationId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(member.name ?? "");
  const [role, setRole] = useState<CongregationMember["role"]>(member.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const allowedRoles = currentRole === "ADMIN" ? EDITABLE_ROLES_ADMIN : EDITABLE_ROLES_ANCIAO;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await congregationsApi.updateMember(congregationId, {
        userId: member.id,
        name: name.trim() || undefined,
        role:
          role !== member.role && role !== "ADMIN"
            ? (role as "ANCIAO" | "PUBLICADOR" | "SERVO_DE_CAMPO")
            : undefined,
      });
      onSaved();
    } catch {
      setError("Erro ao salvar alterações.");
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
      <div className="card w-full max-w-sm flex flex-col">
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-1">Editar Membro</h2>
        <p className="text-sm text-[var(--color-text-light)] mb-4 truncate">{member.email}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="edit-member-name" className="input-label">Nome</label>
            <input
              id="edit-member-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input mt-1"
              placeholder="Nome do membro"
            />
          </div>

          <div>
            <label htmlFor="edit-member-role" className="input-label">Função</label>
            <select
              id="edit-member-role"
              value={role}
              onChange={(e) => setRole(e.target.value as CongregationMember["role"])}
              className="input mt-1"
            >
              {allowedRoles.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
              {/* Se role atual não está nas opções (ex: ANCIAO vendo outro ANCIAO via ADMIN) */}
              {!allowedRoles.includes(member.role) && (
                <option value={member.role}>{ROLE_LABELS[member.role]}</option>
              )}
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
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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
  // ADMIN e ANCIAO podem gerenciar qualquer membro exceto ADMINs
  const canShowActions =
    (currentRole === "ADMIN" || currentRole === "ANCIAO") && member.role !== "ADMIN";
  // Edição de nome/função: idem, nunca sobre membros ADMIN
  const canEdit =
    (currentRole === "ADMIN" || currentRole === "ANCIAO") && member.role !== "ADMIN";
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);

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
    <>
      <div
        className="card py-3 px-4"
        style={{
          borderColor: member.isBlocked ? "var(--color-danger)" : "var(--color-border)",
          opacity: member.isBlocked ? 0.75 : 1,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--color-text)] truncate">
              {member.name || member.email}
            </p>
            {member.name && (
              <p className="text-xs text-[var(--color-text-light)] truncate">{member.email}</p>
            )}
            <p className="text-xs text-[var(--color-text-light)] mt-0.5">
              {ROLE_LABELS[member.role]} · {member._count.revisits} revisitas
              {member.isBlocked && (
                <span className="ml-2 font-semibold text-[#f87171]">BLOQUEADO</span>
              )}
            </p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            {canEdit && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                disabled={loading}
                className="btn-secondary text-xs py-1 px-2"
                aria-label="Editar membro"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
            {canShowActions && (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>
      {editing && (
        <EditMemberModal
          member={member}
          currentRole={currentRole}
          congregationId={congregationId}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onUpdate();
          }}
        />
      )}
    </>
  );
}

// ── Territory Card ────────────────────────────────────────────────────────────

function TerritoryCard({
  territory,
  canManage,
  role,
  onDelete,
}: {
  territory: TerritoryListItem;
  canManage?: boolean;
  role?: string | null;
  onDelete?: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareDone, setShareDone] = useState(false);
  const [shareTarget, setShareTarget] = useState<"congregation" | "ALL">("congregation");

  async function doShare() {
    setShareOpen(false);
    setSharing(true);
    try {
      await territoriesApi.share(territory.id, shareTarget);
      setShareDone(true);
      setTimeout(() => setShareDone(false), 3000);

      // Abre o seletor nativo de compartilhamento (WhatsApp, Telegram, etc.)
      const name = territory.label ?? `Território ${territory.number}`;
      const url = `${window.location.origin}/congregations/territories/${territory.id}`;
      const lastWorked = territory.lastVisitAt
        ? `Último trabalho: ${formatDate(territory.lastVisitAt)}`
        : "Nunca trabalhado";
      const text = `📍 ${name} disponível para trabalho\n${lastWorked}`;

      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: name, text, url }).catch(() => {});
      } else {
        window.open(
          `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
          "_blank"
        );
      }
    } finally {
      setSharing(false);
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  }

  async function confirmDelete() {
    setConfirmOpen(false);
    setDeleting(true);
    try {
      await territoriesApi.delete(territory.id);
      onDelete?.();
    } catch {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="relative rounded-2xl overflow-hidden"
        style={{
          background: "var(--color-surface-card)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-soft)",
        }}>
        <Link
          href={`/congregations/territories/${territory.id}`}
          className="block transition-transform active:scale-[0.98]">
          {/* Imagem / Placeholder do território */}
          <div className="relative w-full bg-black/30" style={{ aspectRatio: "16/9" }}>
            {territory.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={territory.imageUrl}
                alt={`Território ${territory.label ?? territory.number}`}
                className="w-full h-full object-contain"
                loading="lazy"
              />
            ) : (
              // Sem imageUrl: tenta imagem legado por número, com fallback SVG via onError
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/territorios/${territory.number}.png`}
                alt={`Território ${territory.label ?? territory.number}`}
                className="w-full h-full object-contain"
                loading="lazy"
                onError={(e) => {
                  // Se a imagem legado não existe, substitui por placeholder SVG
                  const target = e.currentTarget;
                  const parent = target.parentElement;
                  if (parent) {
                    const placeholder = document.createElement("div");
                    placeholder.className = "w-full h-full flex items-center justify-center";
                    placeholder.style.background = `${territory.color}22`;
                    placeholder.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="${territory.color}" stroke-width="1.5" class="w-10 h-10 opacity-60" aria-hidden="true"><path d="M3 6.5L8.5 4L15.5 6.5L21 4V17.5L15.5 20L8.5 17.5L3 20V6.5Z"/><path d="M8.5 4V17.5"/><path d="M15.5 6.5V20"/></svg>`;
                    parent.replaceChild(placeholder, target);
                  }
                }}
              />
            )}
            {/* Badge rótulo */}
            <div
              className="absolute top-2 left-2 min-w-[32px] h-7 rounded-full flex items-center justify-center px-2 text-xs font-bold text-white shadow"
              style={{ background: territory.color || "var(--color-primary)" }}>
              {territory.label ?? territory.number}
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
                Território {territory.label ?? territory.number}
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

            {canManage && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShareOpen(true); }}
                disabled={sharing}
                className="mt-2.5 w-full py-1.5 rounded-xl text-xs font-semibold transition-opacity active:opacity-70 flex items-center justify-center gap-1.5"
                style={shareDone
                  ? { background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }
                  : { background: "rgba(37,99,255,0.10)", color: "#2563ff", border: "1px solid rgba(37,99,255,0.2)" }}
              >
                {sharing ? (
                  <><div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" /> Enviando...</>
                ) : shareDone ? (
                  <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg> Notificação enviada!</>
                ) : (
                  <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5" aria-hidden="true"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg> Compartilhar</>)
                }
              </button>
            )}
          </div>
        </Link>

        {/* Botão apagar — apenas para gestores */}
        {canManage && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmOpen(true); }}
            disabled={deleting}
            className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.55)" }}
            aria-label="Apagar território"
          >
            {deleting ? (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"
                className="w-3.5 h-3.5" aria-hidden="true">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Modal compartilhar */}
      {shareOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-5"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setShareOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl p-5 flex flex-col gap-4"
            style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "rgba(37,99,255,0.12)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#2563ff" strokeWidth="1.8"
                  className="w-6 h-6" aria-hidden="true">
                  <path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/>
                </svg>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-[var(--color-text)] mb-1">
                Compartilhar território &ldquo;{territory.label ?? territory.number}&rdquo;?
              </p>
              <p className="text-xs text-[var(--color-text-light)]">
                Uma notificação será enviada com o link para abrir este território.
              </p>
              {territory.lastVisitAt && (
                <p className="text-xs text-[var(--color-text-light)] mt-1">
                  Último trabalho: {formatDate(territory.lastVisitAt)}
                </p>
              )}
            </div>

            {/* Seletor de público — apenas ADMIN */}
            {role === "ADMIN" && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-[var(--color-text-light)] uppercase tracking-wide">Enviar para</p>
                {([
                  { value: "congregation", label: "Congregação vinculada", desc: "Apenas membros desta congregação" },
                  { value: "ALL",          label: "Todos os membros",      desc: "Todo o sistema" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setShareTarget(opt.value)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                    style={{
                      background: shareTarget === opt.value ? "rgba(37,99,255,0.12)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${shareTarget === opt.value ? "rgba(37,99,255,0.4)" : "var(--color-border)"}`,
                    }}
                  >
                    <div
                      className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                      style={{ borderColor: shareTarget === opt.value ? "#2563ff" : "var(--color-border)" }}
                    >
                      {shareTarget === opt.value && (
                        <div className="w-2 h-2 rounded-full" style={{ background: "#2563ff" }} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--color-text)]">{opt.label}</p>
                      <p className="text-xs text-[var(--color-text-light)]">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                className="btn-secondary flex-1 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={doShare}
                className="flex-1 py-2 text-sm rounded-xl font-semibold text-white transition-opacity active:opacity-80"
                style={{ background: "#2563ff" }}
              >
                Compartilhar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-5"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl p-5 flex flex-col gap-4"
            style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ícone */}
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "rgba(220,38,38,0.12)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="1.8"
                  className="w-6 h-6" aria-hidden="true">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                </svg>
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm font-semibold text-[var(--color-text)] mb-1">
                Apagar território &ldquo;{territory.label ?? territory.number}&rdquo;?
              </p>
              <p className="text-xs text-[var(--color-text-light)]">
                Todas as ruas, casas e visitas serão removidas permanentemente.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="btn-secondary flex-1 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 py-2 text-sm rounded-xl font-semibold text-white transition-opacity active:opacity-80"
                style={{ background: "var(--color-danger)" }}
              >
                Apagar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Territories Tab ───────────────────────────────────────────────────────────

function TerritoriesTab({ congregationId, role }: { congregationId: string; role: string | null }) {
  const [territories, setTerritories] = useState<TerritoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    territoriesApi.list()
      .then(({ data }) => setTerritories(data))
      .catch(() => setTerritories([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load, congregationId]);

  const canManage = role ? TERRITORY_MANAGER_ROLES.includes(role) : false;

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
      <>
        {canManage && (
          <div className="flex justify-end mb-3">
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="btn-primary flex items-center gap-2 py-2 px-4 text-sm"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                className="w-4 h-4" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Novo Território
            </button>
          </div>
        )}
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
        {showCreate && (
          <CreateTerritoryModal
            onClose={() => setShowCreate(false)}
            onCreated={() => { setShowCreate(false); load(); }}
          />
        )}
      </>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-[var(--color-text-light)]">
          {territories.length} territórios — toque para ver ruas e casas
        </p>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2 py-1.5 px-3 text-xs"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              className="w-3.5 h-3.5" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Novo
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {territories.map((t) => (
          <TerritoryCard key={t.id} territory={t} canManage={canManage} role={role} onDelete={load} />
        ))}
      </div>
      {showCreate && (
        <CreateTerritoryModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}

// ── Main Content ──────────────────────────────────────────────────────────────

function CongregationContent() {
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const congregationId = useAuthStore((s) => s.congregationId);
  const name = useAuthStore((s) => s.name);
  const logout = useAuthStore((s) => s.logout);
  const handleLogout = () => { logout(); router.replace("/login"); };
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
      <header className="mobile-header justify-between">
        <div>
          <p className="mobile-header__meta">Minha Congregação</p>
          <h1 className="mobile-header__title">
            {congregation ? congregation.name : (name ?? "Congregação")}
          </h1>
        </div>
        <button
          className="text-sm w-auto px-3 py-2 rounded-lg border border-white/35 text-white font-semibold bg-white/10 hover:bg-white/20 transition-colors"
          onClick={handleLogout}
          type="button"
        >
          Sair
        </button>
      </header>

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
          <div className="flex flex-col gap-4">
            <div className="card text-center py-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: "var(--color-primary-soft)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5"
                  className="w-6 h-6" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <p className="text-sm text-[var(--color-text-light)] leading-relaxed">
                Você ainda não foi vinculado a uma congregação.<br />
                Aguarde o Ancião vincular seu acesso.
              </p>
            </div>

            <div className="card py-5 px-4"
              style={{ borderColor: "var(--color-primary)", borderWidth: "1px" }}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: "var(--color-primary-soft)" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5"
                    className="w-5 h-5" aria-hidden="true">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text)] mb-1">
                    É Ancião e quer cadastrar sua congregação?
                  </p>
                  <p className="text-xs text-[var(--color-text-light)] leading-relaxed mb-3">
                    Envie um e-mail para o administrador com os dados da sua congregação:
                  </p>
                  <ul className="text-xs text-[var(--color-text-light)] mb-3 flex flex-col gap-1 pl-1">
                    <li className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full shrink-0" style={{ background: "var(--color-primary)" }} />
                      Nome da congregação
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full shrink-0" style={{ background: "var(--color-primary)" }} />
                      Estado
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full shrink-0" style={{ background: "var(--color-primary)" }} />
                      Cidade
                    </li>
                  </ul>
                  <a
                    href="mailto:1FPaschuini@jwpub.org?subject=Cadastro%20de%20Congrega%C3%A7%C3%A3o&body=Nome%3A%20%0AEstado%3A%20%0ACidade%3A%20"
                    className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-2"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      className="w-3.5 h-3.5" aria-hidden="true">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    1FPaschuini@jwpub.org
                  </a>
                </div>
              </div>
            </div>
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
                <div className="mt-3 p-3 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
                  <p className="text-xs font-semibold text-[#f87171] mb-1">Motivo da recusa:</p>
                  <p className="text-sm text-[#fca5a5]">{congregation.rejectionReason}</p>
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
                    {role === "PUBLICADOR" ? (
                      /* Publicador: apenas total */
                      <div className="card text-center py-6">
                        <p className="text-3xl font-bold text-[var(--color-primary)]">
                          {congregation._count?.members ?? congregation.members?.length ?? 0}
                        </p>
                        <p className="text-sm text-[var(--color-text-light)] mt-1">publicador(es) na congregação</p>
                      </div>
                    ) : congregation.members && congregation.members.length === 0 ? (
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
                  <TerritoriesTab congregationId={congregation.id} role={role} />
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
