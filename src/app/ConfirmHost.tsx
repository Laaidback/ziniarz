import { useStore } from 'zustand';
import { confirmStore } from './confirm';

export function ConfirmHost() {
  const request = useStore(confirmStore, (s) => s.request);
  if (!request) return null;
  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Potwierdzenie">
        <p>{request.message}</p>
        <div className="dialog-buttons">
          <button type="button" onClick={() => request.answer(false)}>
            Anuluj
          </button>
          <button type="button" className="danger" autoFocus onClick={() => request.answer(true)}>
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
