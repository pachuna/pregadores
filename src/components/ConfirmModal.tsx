"use client";

export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="card w-full max-w-sm flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text)]">{title}</h2>
          <p className="text-sm text-[var(--color-text-light)] mt-1 break-all">{message}</p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary flex-1">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm transition-opacity hover:opacity-80"
            style={
              danger
                ? { background: "var(--color-danger)", color: "#fff" }
                : { background: "var(--color-primary)", color: "#fff" }
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
