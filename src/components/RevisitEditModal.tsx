"use client";

import { useEffect, useState } from "react";
import { revisitsApi } from "@/lib/api";
import type { Revisit } from "@/lib/types";

type VisitHistoryItem = {
  date: string;
  summary: string;
};

function parseVisitHistory(revisit: Revisit): VisitHistoryItem[] {
  const notes = revisit.notes?.trim();
  if (!notes) return [];

  const parsed = notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^\[(\d{4}-\d{2}-\d{2})\]\s+(.+)$/);
      if (!match) return null;
      return { date: match[1], summary: match[2] };
    })
    .filter((item): item is VisitHistoryItem => item !== null);

  if (parsed.length > 0) return [...parsed].reverse();
  return [{ date: revisit.visitDate.slice(0, 10), summary: notes }];
}

interface Props {
  revisit: Revisit;
  onClose: () => void;
  onUpdate: (updated: Revisit) => void;
  onDelete: (id: string) => void;
}

export default function RevisitEditModal({ revisit, onClose, onUpdate, onDelete }: Props) {
  const [editName, setEditName] = useState(revisit.name);
  const [editAddress, setEditAddress] = useState(revisit.address);
  const [editIsActive, setEditIsActive] = useState(revisit.isActive);
  const [newVisitDate, setNewVisitDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newVisitSummary, setNewVisitSummary] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [savedRevisit, setSavedRevisit] = useState(revisit);

  useEffect(() => {
    setEditName(revisit.name);
    setEditAddress(revisit.address);
    setEditIsActive(revisit.isActive);
    setNewVisitDate(new Date().toISOString().slice(0, 10));
    setNewVisitSummary("");
    setSaveError("");
    setSavedRevisit(revisit);
  }, [revisit]);

  const hasUnsavedChanges =
    editName.trim() !== savedRevisit.name.trim() ||
    editAddress.trim() !== savedRevisit.address.trim() ||
    editIsActive !== savedRevisit.isActive ||
    newVisitSummary.trim().length > 0 ||
    newVisitDate !== new Date().toISOString().slice(0, 10);

  const handleSave = async (): Promise<boolean> => {
    if (!editName.trim() || !editAddress.trim()) {
      setSaveError("Nome e endereço são obrigatórios.");
      return false;
    }
    setSaveError("");
    setIsSaving(true);
    try {
      const { data } = await revisitsApi.update(revisit.id, {
        name: editName.trim(),
        address: editAddress.trim(),
        isActive: editIsActive,
        newVisitDate,
        newVisitSummary: newVisitSummary.trim() || undefined,
      });
      setSavedRevisit(data);
      onUpdate(data);
      setNewVisitSummary("");
      return true;
    } catch {
      setSaveError("Não foi possível salvar a revisita.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickRegisterToday = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const summary = newVisitSummary.trim() || "Visita realizada.";
    if (!editName.trim() || !editAddress.trim()) {
      setSaveError("Nome e endereço são obrigatórios.");
      return;
    }
    setSaveError("");
    setIsSaving(true);
    try {
      const { data } = await revisitsApi.update(revisit.id, {
        name: editName.trim(),
        address: editAddress.trim(),
        isActive: editIsActive,
        newVisitDate: today,
        newVisitSummary: summary,
      });
      setSavedRevisit(data);
      onUpdate(data);
      setNewVisitSummary("");
    } catch {
      setSaveError("Não foi possível registrar a visita.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await revisitsApi.delete(revisit.id);
      onDelete(revisit.id);
    } catch {
      setSaveError("Não foi possível apagar a revisita.");
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRequestClose = () => {
    if (!hasUnsavedChanges) {
      onClose();
      return;
    }
    setShowCloseConfirm(true);
  };

  return (
    <>
      {/* Main edit modal */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px] flex items-end justify-center p-3"
        aria-modal="true"
        role="dialog"
      >
        <section className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-white shadow-[var(--shadow-strong)] p-4 max-h-[88vh] overflow-auto">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[var(--color-text-light)]">
                Editar revisita
              </p>
              <h2 className="text-xl font-bold text-[var(--color-primary-dark)] truncate mt-1">
                {revisit.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleRequestClose}
              className="w-8 h-8 rounded-md bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)] font-bold"
              aria-label="Fechar detalhes"
            >
              ×
            </button>
          </div>

          <div className="flex flex-col gap-3 text-sm text-[var(--color-text)]">
            <div>
              <label htmlFor="edit-name" className="input-label">Nome</label>
              <input
                id="edit-name"
                className="input-field"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="edit-address" className="input-label">Endereço</label>
              <input
                id="edit-address"
                className="input-field"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
              />
            </div>

            <div>
              <label className="input-label">Status da revisita</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                    editIsActive
                      ? "border-green-600 bg-green-100 text-green-800"
                      : "border-[var(--color-border)] bg-white text-[var(--color-text-light)]"
                  }`}
                  onClick={() => setEditIsActive(true)}
                >
                  Ativa
                </button>
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                    !editIsActive
                      ? "border-slate-500 bg-slate-200 text-slate-700"
                      : "border-[var(--color-border)] bg-white text-[var(--color-text-light)]"
                  }`}
                  onClick={() => setEditIsActive(false)}
                >
                  Inativa
                </button>
              </div>
            </div>

            <div className="surface-note">
              <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[var(--color-text-light)] mb-2">
                Registrar nova visita
              </p>
              <div className="flex flex-col gap-2">
                <div>
                  <label htmlFor="new-visit-date" className="input-label">Data da visita</label>
                  <input
                    id="new-visit-date"
                    type="date"
                    className="input-field"
                    value={newVisitDate}
                    onChange={(e) => setNewVisitDate(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="new-visit-summary" className="input-label">O que aconteceu na visita</label>
                  <textarea
                    id="new-visit-summary"
                    className="input-field"
                    rows={3}
                    placeholder="Ex.: retorno agendado para próxima semana"
                    value={newVisitSummary}
                    onChange={(e) => setNewVisitSummary(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="surface-note">
              <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[var(--color-text-light)] mb-2">
                Histórico de visitas
              </p>
              {parseVisitHistory(savedRevisit).length === 0 ? (
                <p className="text-xs text-[var(--color-text-light)]">
                  Ainda não há visitas registradas no histórico.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {parseVisitHistory(savedRevisit).map((item, index) => (
                    <div
                      key={`${item.date}-${index}`}
                      className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
                    >
                      <p className="text-xs font-semibold text-[var(--color-primary-dark)]">
                        {new Date(`${item.date}T00:00:00`).toLocaleDateString("pt-BR")}
                      </p>
                      <p className="text-xs text-[var(--color-text)] mt-1">{item.summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {saveError && (
              <p className="text-sm text-[var(--color-danger)] text-center">{saveError}</p>
            )}

            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? "Salvando..." : "Salvar alterações"}
            </button>

            <button
              type="button"
              className="w-full rounded-[10px] border border-[var(--color-primary)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-primary-dark)]"
              onClick={handleQuickRegisterToday}
              disabled={isSaving}
            >
              {isSaving ? "Registrando..." : "Registrar visita de hoje"}
            </button>

            <button
              type="button"
              className="w-full rounded-[10px] border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isSaving || isDeleting}
            >
              Apagar revisita
            </button>
          </div>
        </section>
      </div>

      {/* Close confirm overlay */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-[2px] flex items-center justify-center p-4 modal-fade-in">
          <section className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-white shadow-[var(--shadow-strong)] p-4 modal-pop-in">
            <div className="mb-3 inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 8V12" />
                <circle cx="12" cy="16" r="0.7" fill="currentColor" stroke="none" />
                <path d="M10.3 3.9L2.7 17.2A1.5 1.5 0 0 0 4 19.5h16a1.5 1.5 0 0 0 1.3-2.3L13.7 3.9a1.5 1.5 0 0 0-2.4 0Z" />
              </svg>
            </div>
            <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[var(--color-text-light)]">
              Confirmar fechamento
            </p>
            <h3 className="text-lg font-bold text-[var(--color-primary-dark)] mt-1">
              Há alterações não salvas
            </h3>
            <p className="text-sm text-[var(--color-text)] mt-2">
              Deseja salvar as alterações antes de fechar esta revisita?
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className="btn-primary"
                onClick={async () => {
                  const ok = await handleSave();
                  if (ok) { setShowCloseConfirm(false); onClose(); }
                }}
                disabled={isSaving}
              >
                {isSaving ? "Salvando..." : "Salvar e fechar"}
              </button>
              <button
                type="button"
                className="w-full rounded-[10px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-text)]"
                onClick={() => { setShowCloseConfirm(false); onClose(); }}
                disabled={isSaving}
              >
                Fechar sem salvar
              </button>
              <button
                type="button"
                className="w-full rounded-[10px] border border-[var(--color-primary)] bg-[var(--color-primary-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-primary-dark)]"
                onClick={() => setShowCloseConfirm(false)}
                disabled={isSaving}
              >
                Continuar editando
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Delete confirm overlay */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-[2px] flex items-center justify-center p-4 modal-fade-in">
          <section className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-white shadow-[var(--shadow-strong)] p-4 modal-pop-in">
            <div className="mb-3 inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-100 text-red-600">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </div>
            <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[var(--color-text-light)]">
              Confirmar exclusão
            </p>
            <h3 className="text-lg font-bold text-[var(--color-primary-dark)] mt-1">
              Apagar revisita
            </h3>
            <p className="text-sm text-[var(--color-text)] mt-2">
              Tem certeza que deseja apagar <strong>{revisit.name}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className="w-full rounded-[10px] border border-red-400 bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Apagando..." : "Sim, apagar"}
              </button>
              <button
                type="button"
                className="w-full rounded-[10px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-text)]"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancelar
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
