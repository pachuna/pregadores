"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { adminApi, type AdminUser } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import AuthGuard from "@/components/AuthGuard";
import MobileBottomNav from "@/components/MobileBottomNav";

type RoleOption = "ADMIN" | "ANCIAO" | "PUBLICADOR";

const ROLE_LABELS: Record<RoleOption, string> = {
  ADMIN: "Administrador",
  ANCIAO: "Ancião",
  PUBLICADOR: "Publicador",
};

const ROLE_COLORS: Record<RoleOption, string> = {
  ADMIN: "bg-red-100 text-red-700 border-red-200",
  ANCIAO: "bg-blue-100 text-blue-700 border-blue-200",
  PUBLICADOR: "bg-green-100 text-green-700 border-green-200",
};

interface EditModalProps {
  user: AdminUser;
  onClose: () => void;
  onSave: (id: string, data: { role?: RoleOption }) => Promise<void>;
}

function EditModal({ user, onClose, onSave }: EditModalProps) {
  const [role, setRole] = useState<RoleOption>(user.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSave(user.id, { role });
      onClose();
    } catch {
      setError("Erro ao salvar. Tente novamente.");
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
      <div className="card w-full max-w-md">
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-1">
          Editar Usuário
        </h2>
        <p className="text-sm text-[var(--color-text-light)] mb-5 truncate">
          {user.email}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="edit-role" className="input-label">
              Perfil de acesso
            </label>
            <select
              id="edit-role"
              value={role}
              onChange={(e) => setRole(e.target.value as RoleOption)}
              className="input mt-1"
            >
              <option value="PUBLICADOR">Publicador</option>
              <option value="ANCIAO">Ancião</option>
              <option value="ADMIN">Administrador</option>
            </select>
            <p className="text-xs text-[var(--color-text-light)] mt-1">
              Para vincular à congregação, acesse o{" "}
              <Link href="/admin/congregations" className="underline">
                painel de congregações
              </Link>
              .
            </p>
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

function ConfirmDialog({
  title, message, confirmLabel, dangerMode, onConfirm, onCancel, loading,
}: {
  title: string; message: string; confirmLabel: string; dangerMode?: boolean;
  onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="card w-full max-w-sm text-center">
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{title}</h2>
        <p className="text-sm text-[var(--color-text-light)] mb-6">{message}</p>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary flex-1" disabled={loading}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 btn-primary"
            style={dangerMode ? { background: "var(--color-danger)", borderColor: "var(--color-danger)" } : undefined}
          >
            {loading ? "Aguarde..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminContent() {
  const role = useAuthStore((s) => s.role);
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: "block" | "unblock" | "delete"; user: AdminUser } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (role && role !== "ADMIN") router.replace("/home");
  }, [role, router]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await adminApi.listUsers();
      setUsers(data);
    } catch {
      setError("Não foi possível carregar os usuários.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleSaveEdit = async (id: string, data: { role?: RoleOption }) => {
    await adminApi.updateUser(id, data);
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data } : u)));
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      if (confirmAction.type === "delete") {
        await adminApi.deleteUser(confirmAction.user.id);
        setUsers((prev) => prev.filter((u) => u.id !== confirmAction.user.id));
      } else {
        const isBlocked = confirmAction.type === "block";
        await adminApi.updateUser(confirmAction.user.id, { isBlocked });
        setUsers((prev) => prev.map((u) => u.id === confirmAction.user.id ? { ...u, isBlocked } : u));
      }
      setConfirmAction(null);
    } catch {
      setError("Erro ao executar ação. Tente novamente.");
    } finally {
      setActionLoading(false);
    }
  };

  if (role && role !== "ADMIN") return null;

  return (
    <div className="mobile-page min-h-screen pb-24">
      {/* Header */}
      <div
        className="px-4 pt-10 pb-6"
        style={{ background: "linear-gradient(145deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)" }}
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
        <h1 className="text-2xl font-bold text-white">Painel de Admin</h1>
        <p className="text-white/70 text-sm mt-1">Gerenciamento de usuários</p>
      </div>

      <div className="px-4 pt-5">
        {/* Quick links */}
        <Link
          href="/admin/congregations"
          className="flex items-center justify-between p-4 rounded-2xl border mb-5"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface-alt, #f8fafc)" }}
        >
          <div>
            <p className="font-semibold text-sm text-[var(--color-text)]">Congregações</p>
            <p className="text-xs text-[var(--color-text-light)] mt-0.5">Aprovar e gerenciar congregações</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-[var(--color-primary)]" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {(["PUBLICADOR", "ANCIAO", "ADMIN"] as RoleOption[]).map((r) => (
            <div key={r} className="card text-center py-3 px-2" style={{ borderColor: "var(--color-border)" }}>
              <span className="text-2xl font-bold text-[var(--color-primary)]">
                {users.filter((u) => u.role === r).length}
              </span>
              <p className="text-xs text-[var(--color-text-light)] mt-0.5">{ROLE_LABELS[r]}</p>
            </div>
          ))}
        </div>

        {error && (
          <div className="rounded-xl p-3 mb-4 text-sm text-center" style={{ background: "#fef2f2", color: "var(--color-danger)", border: "1px solid #fecaca" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }} />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[var(--color-text-light)]">Nenhum usuário encontrado.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="card"
                style={{ borderColor: user.isBlocked ? "var(--color-danger)" : "var(--color-border)", opacity: user.isBlocked ? 0.75 : 1 }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--color-text)] text-sm truncate">{user.email}</p>
                    {user.congregationId && (
                      <p className="text-xs text-[var(--color-text-light)] truncate mt-0.5">
                        Vinculado a congregação
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${ROLE_COLORS[user.role]}`}>
                    {ROLE_LABELS[user.role]}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-[var(--color-text-light)] mb-3">
                  <span>{user._count.revisits} revisitas</span>
                  <span>·</span>
                  <span>Desde {new Date(user.createdAt).toLocaleDateString("pt-BR")}</span>
                  {user.isBlocked && <><span>·</span><span className="font-semibold text-red-600">BLOQUEADO</span></>}
                </div>

                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditingUser(user)} className="btn-secondary text-xs py-1.5 px-3 flex-1">
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmAction({ type: user.isBlocked ? "unblock" : "block", user })}
                    className="btn-secondary text-xs py-1.5 px-3 flex-1"
                    style={user.isBlocked ? { color: "var(--color-success, #16a34a)" } : { color: "var(--color-warning, #b45309)" }}
                  >
                    {user.isBlocked ? "Desbloquear" : "Bloquear"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmAction({ type: "delete", user })}
                    className="btn-secondary text-xs py-1.5 px-3"
                    style={{ color: "var(--color-danger)" }}
                    aria-label={`Excluir ${user.email}`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden="true">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingUser && (
        <EditModal user={editingUser} onClose={() => setEditingUser(null)} onSave={handleSaveEdit} />
      )}

      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.type === "delete" ? "Excluir usuário" : confirmAction.type === "block" ? "Bloquear usuário" : "Desbloquear usuário"}
          message={
            confirmAction.type === "delete"
              ? `Excluir permanentemente "${confirmAction.user.email}" e todas as suas revisitas?`
              : confirmAction.type === "block"
              ? `Bloquear o acesso de "${confirmAction.user.email}"?`
              : `Restaurar o acesso de "${confirmAction.user.email}"?`
          }
          confirmLabel={confirmAction.type === "delete" ? "Excluir" : confirmAction.type === "block" ? "Bloquear" : "Desbloquear"}
          dangerMode={confirmAction.type === "delete" || confirmAction.type === "block"}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmAction(null)}
          loading={actionLoading}
        />
      )}
      <MobileBottomNav />
    </div>
  );
}

export default function AdminPage() {
  return (
    <AuthGuard>
      <AdminContent />
    </AuthGuard>
  );
}

