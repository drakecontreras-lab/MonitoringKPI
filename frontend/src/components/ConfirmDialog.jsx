import React, { useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Modal de confirmación/prompt genérico, mismo estilo visual que los
 * demás modales de la app (glass-card + backdrop blur).
 *
 * mode: 'confirm' (solo mensaje + OK/Cancelar) o 'prompt' (mensaje + input de texto).
 */
export default function ConfirmDialog({ mode = 'confirm', icon = 'help', title, message, defaultValue = '', confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false, onConfirm, onCancel }) {
  const [value, setValue] = useState(defaultValue);

  const handleConfirm = () => {
    if (mode === 'prompt' && !value.trim()) return;
    onConfirm(mode === 'prompt' ? value.trim() : undefined);
  };

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div className="glass-card flex-col gap-1 text-center animate-scale-up" style={{ width: '100%', maxWidth: '400px', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)', alignItems: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
        <span className="material-icons" style={{ fontSize: '3rem', marginBottom: '0.25rem', color: danger ? 'var(--danger, #ef4444)' : 'var(--secondary)' }}>{icon}</span>
        {title && <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.15rem' }}>{title}</h3>}
        {message && <p className="text-muted" style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>{message}</p>}
        {mode === 'prompt' && (
          <input
            type="text"
            className="form-control"
            style={{ marginTop: '0.5rem' }}
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
          />
        )}
        <div className="flex gap-1" style={{ width: '100%', marginTop: '1rem' }}>
          <button type="button" onClick={onCancel} className="btn btn-secondary flex-1">{cancelLabel}</button>
          <button type="button" onClick={handleConfirm} disabled={mode === 'prompt' && !value.trim()} className={`btn ${danger ? 'btn-danger' : 'btn-primary'} flex-1`}>{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
