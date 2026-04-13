"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  congregationsApi,
  adminApi,
  type Congregation,
  type AdminUser,
  type CongregationMember,
} from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import AuthGuard from "@/components/AuthGuard";
import MobileBottomNav from "@/components/MobileBottomNav";
import { useIBGEStates, useIBGECities } from "@/lib/ibge";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700 border-yellow-200",
  ACTIVE: "bg-green-100 text-green-700 border-green-200",
  BLOCKED: "bg-red-100 text-red-700 border-red-200",
  REJECTED: "bg-gray-100 text-gray-600 border-gray-300",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  ACTIVE: "Ativa",
  BLOCKED: "Bloqueada",
  REJECTED: "Recusada",
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  ANCIAO: "Ancião",
  PUBLICADOR: "Publicador",
};

function MembersSection({
  congregationId,
  reload,
}: {
  congregationId: string;
  reload: () => void;
}) {
  const [members, setMembers] = useState<CongregationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await congregationsApi.getById(congregationId);
      setMembers(data.members ?? []);
    } catch {
      setError("Erro ao carregar membros.");
    } finally {
      setLoading(false);
    }
  }, [congregationId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const removeMember = async (member: CongregationMember) => {
    if (!confirm(`Remover ${member.email} da congregação?`)) return;
    setRemoving(member.id);
    try {
      await congregationsApi.removeMember(congregationId, member.id);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      reload();
    } catch {
      setError("Erro ao remover membro.");
    } finally {
      setRemoving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div
          className="w-5 h-5 rounded-full border-2 animate-spin"
          style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-[var(--color-danger)] py-2">{error}</p>;
  }

  if (members.length === 0) {
    return (
      <p className="text-xs text-[var(--color-text-light)] py-2 text-center">
        Nenhum membro vinculado.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 mt-1">
      {members.map((m) => (
        <div
          key={m.id}
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border"
          style={{
            borderColor: m.isBlocked ? "var(--color-danger)" : "var(--color-border)",
            background: "var(--color-surface-alt, #f8f9fb)",
            opacity: m.isBlocked ? 0.75 : 1,
          }}
        >
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--color-text)] truncate">{m.email}</p>
            <p className="text-[10px] text-[var(--color-text-light)] mt-0.5">
              {ROLE_LABELS[m.role]} · {m._count.revisits} revisita(s)
              {m.isBlocked && <span className="ml-1 font-semibold text-red-600">BLOQUEADO</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={() => removeMember(m)}
            disabled={removing === m.id}
            className="btn-secondary text-xs py-1 px-2 shrink-0"
            style={{ color: "var(--color-danger)", width: "auto" }}
            aria-label={`Remover ${m.email}`}
          >
            {removing === m.id ? (
              "..."
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden="true">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
              </svg>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Modal Recusar Congregação ──────────────────────────────────────────────

interface RejectModalProps {
  congregation: Congregation;
  onClose: () => void;
  onRejected: () => void;
}

function RejectModal({ congregation, onClose, onRejected }: RejectModalProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Informe o motivo da recusa.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await congregationsApi.update(congregation.id, {
        status: "REJECTED",
        rejectionReason: reason.trim(),
      });
      onRejected();
    } catch (err: unknown) {
      const msg =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { error?: string } } }).response?.data?.error === "string"
          ? (err as { response: { data: { error: string } } }).response.data.error
          : "Erro ao recusar. Tente novamente.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card w-full max-w-md flex flex-col">
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-1">
          Recusar Solicitação
        </h2>
        <p className="text-sm text-[var(--color-text-light)] mb-4 truncate">
          {congregation.name} — {congregation.city}/{congregation.state}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label htmlFor="rejection-reason" className="input-label">
              Motivo da recusa <span className="text-[var(--color-danger)]">*</span>
            </label>
            <textarea
              id="rejection-reason"
              className="input mt-1 resize-none"
              rows={4}
              placeholder="Descreva o motivo da recusa para que o solicitante possa corrigir..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-[var(--color-danger)] text-center">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={loading}
              style={{ background: "var(--color-danger)" }}
            >
              {loading ? "Recusando..." : "Recusar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type LinkMode = "ANCIAO" | "PUBLICADOR";

const LINK_MODE_LABELS: Record<LinkMode, string> = {
  ANCIAO: "Ancião",
  PUBLICADOR: "Publicador",
};

interface LinkElderModalProps {
  congregation: Congregation;
  mode: LinkMode;
  onClose: () => void;
  onLinked: () => void;
}

function LinkElderModal({ congregation, mode, onClose, onLinked }: LinkElderModalProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi
      .listUsers()
      .then(({ data }) =>
        setUsers(
          data.filter(
            (u) => u.role === mode && !u.congregationId && !u.isBlocked
          )
        )
      )
      .catch(() => setError("Erro ao carregar usuários."))
      .finally(() => setLoading(false));
  }, [mode]);

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
      // 2. Vincular usuário com a role correta + congregationId
      await congregationsApi.addMember(congregation.id, user.id, mode);
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
          Vincular {LINK_MODE_LABELS[mode]}
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
                  style={{ width: "auto" }}
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

// ── Modal Editar Congregação ───────────────────────────────────────────────

interface EditCongregationModalProps {
  congregation: Congregation;
  onClose: () => void;
  onSaved: (updated: Congregation) => void;
}

function EditCongregationModal({ congregation, onClose, onSaved }: EditCongregationModalProps) {
  const [name, setName] = useState(congregation.name);
  const [jwEmail, setJwEmail] = useState(congregation.jwEmail);
  const [selectedState, setSelectedState] = useState(congregation.state);
  const [selectedCity, setSelectedCity] = useState(congregation.city);
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
      const { data } = await congregationsApi.update(congregation.id, {
        name: name.trim(),
        jwEmail: jwEmail.trim().toLowerCase(),
        state: selectedState,
        city: selectedCity,
      });
      onSaved(data);
    } catch (err: unknown) {
      const msg =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { error?: string } } }).response?.data?.error === "string"
          ? (err as { response: { data: { error: string } } }).response.data.error
          : "Erro ao salvar. Tente novamente.";
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
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-1">Editar Congregação</h2>
        <p className="text-sm text-[var(--color-text-light)] mb-5 truncate">
          {congregation.city}/{congregation.state}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="edit-name" className="input-label">Nome da congregação</label>
            <input
              id="edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input mt-1"
              required
            />
          </div>

          <div>
            <label htmlFor="edit-email" className="input-label">E-mail JW</label>
            <input
              id="edit-email"
              type="email"
              value={jwEmail}
              onChange={(e) => setJwEmail(e.target.value)}
              className="input mt-1"
              required
            />
          </div>

          <div>
            <label htmlFor="edit-state" className="input-label">Estado</label>
            <select
              id="edit-state"
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
            <label htmlFor="edit-city" className="input-label">Cidade</label>
            <select
              id="edit-city"
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
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal Apagar Congregação ───────────────────────────────────────────────

interface DeleteCongregationModalProps {
  congregation: Congregation;
  onClose: () => void;
  onDeleted: () => void;
}

function DeleteCongregationModal({ congregation, onClose, onDeleted }: DeleteCongregationModalProps) {
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setLoading(true);
    setError("");
    try {
      await congregationsApi.delete(congregation.id);
      onDeleted();
    } catch (err: unknown) {
      const msg =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { error?: string } } }).response?.data?.error === "string"
          ? (err as { response: { data: { error: string } } }).response.data.error
          : "Erro ao apagar. Tente novamente.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card w-full max-w-md flex flex-col gap-4">
        {/* Ícone de alerta */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7 text-red-600" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-[var(--color-text)]">Apagar Congregação</h2>
          <p className="text-sm text-[var(--color-text-light)]">
            <span className="font-semibold text-[var(--color-text)]">{congregation.name}</span>
            {" "}— {congregation.city}/{congregation.state}
          </p>
        </div>

        {/* Aviso */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex flex-col gap-1">
          <p className="text-sm font-semibold text-red-700">Esta ação é irreversível.</p>
          <ul className="list-disc list-inside text-xs text-red-600 mt-1 space-y-1">
            <li>Todos os <b>territórios, ruas, casas e visitas</b> serão excluídos</li>
            <li>
              Os <b>{congregation._count?.members ?? 0} membro(s)</b> serão desvinculados da congregação
            </li>
          </ul>
        </div>

        {/* Campo de confirmação */}
        <div>
          <label htmlFor="delete-confirm" className="input-label">
            Digite <span className="font-bold text-[var(--color-danger)]">APAGAR</span> para confirmar:
          </label>
          <input
            id="delete-confirm"
            type="text"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input mt-1"
            placeholder="APAGAR"
            autoComplete="off"
          />
        </div>

        {error && (
          <p className="text-sm text-[var(--color-danger)] text-center">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading || confirm !== "APAGAR"}
            className="btn-primary flex-1"
            style={{
              background: "var(--color-danger)",
              opacity: confirm !== "APAGAR" ? 0.45 : 1,
            }}
          >
            {loading ? "Apagando..." : "Apagar definitivamente"}
          </button>
        </div>
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
  const [linkTarget, setLinkTarget] = useState<{ congregation: Congregation; mode: LinkMode } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Congregation | null>(null);
  const [editTarget, setEditTarget] = useState<Congregation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Congregation | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());

  const toggleMembers = (id: string) =>
    setExpandedMembers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

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
                        <p className="text-xs text-[var(--color-text-light)] mb-1">
                          {c._count?.members ?? 0} membro(s) · Solicitado por{" "}
                          {c.createdBy?.email ?? "—"}
                        </p>
                        {c.status === "REJECTED" && c.rejectionReason && (
                          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5 mb-3">
                            <span className="font-semibold">Motivo da recusa:</span> {c.rejectionReason}
                          </p>
                        )}
                        {c.status !== "REJECTED" && <div className="mb-3" />}

                        {/* Actions */}
                        <div className="flex gap-2 flex-wrap">
                          {c.status === "PENDING" && (
                            <>
                              <button
                                type="button"
                                onClick={() => setLinkTarget({ congregation: c, mode: "ANCIAO" })}
                                className="btn-primary text-xs py-1.5 px-3 flex-1"
                              >
                                Aprovar e vincular Ancião
                              </button>
                              <button
                                type="button"
                                onClick={() => setRejectTarget(c)}
                                className="btn-secondary text-xs py-1.5 px-3"
                                style={{ color: "var(--color-danger)" }}
                              >
                                Recusar
                              </button>
                            </>
                          )}

                          {c.status === "ACTIVE" && (
                            <>
                              <button
                                type="button"
                                onClick={() => setLinkTarget({ congregation: c, mode: "ANCIAO" })}
                                className="btn-secondary text-xs py-1.5 px-3 flex-1"
                              >
                                Vincular Ancião
                              </button>
                              <button
                                type="button"
                                onClick={() => setLinkTarget({ congregation: c, mode: "PUBLICADOR" })}
                                className="btn-secondary text-xs py-1.5 px-3 flex-1"
                              >
                                Vincular Publicador
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

                          {c.status === "REJECTED" && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(c, "PENDING")}
                              className="btn-secondary text-xs py-1.5 px-3 flex-1"
                            >
                              Recolocar em análise
                            </button>
                          )}

                          {/* Botão editar congregação */}
                          <button
                            type="button"
                            onClick={() => setEditTarget(c)}
                            className="btn-secondary text-xs py-1.5 px-3 shrink-0"
                            aria-label={`Editar ${c.name}`}
                            title="Editar congregação"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden="true">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>

                          {/* Botão apagar congregação */}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(c)}
                            className="btn-secondary text-xs py-1.5 px-3 shrink-0"
                            style={{ color: "var(--color-danger)" }}
                            aria-label={`Apagar ${c.name}`}
                            title="Apagar congregação"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden="true">
                              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                            </svg>
                          </button>

                          {/* Botão ver/ocultar membros */}
                          {(c._count?.members ?? 0) > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleMembers(c.id)}
                              className="btn-secondary text-xs py-1.5 px-3"
                            >
                              {expandedMembers.has(c.id) ? "Ocultar membros" : `Ver membros (${c._count?.members ?? 0})`}
                            </button>
                          )}
                        </div>

                        {/* Lista de membros expandida */}
                        {expandedMembers.has(c.id) && (
                          <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--color-border)" }}>
                            <MembersSection congregationId={c.id} reload={load} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Recusar */}
      {rejectTarget && (
        <RejectModal
          congregation={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onRejected={() => {
            setRejectTarget(null);
            load();
          }}
        />
      )}

      {/* Modal vincular Ancião / Publicador */}
      {linkTarget && (
        <LinkElderModal
          congregation={linkTarget.congregation}
          mode={linkTarget.mode}
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

      {/* Modal editar congregação */}
      {editTarget && (
        <EditCongregationModal
          congregation={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(updated) => {
            setCongregations((prev) =>
              prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
            );
            setEditTarget(null);
          }}
        />
      )}

      {/* Modal apagar congregação */}
      {deleteTarget && (
        <DeleteCongregationModal
          congregation={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setCongregations((prev) => prev.filter((c) => c.id !== deleteTarget.id));
            setDeleteTarget(null);
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
