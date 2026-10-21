import { useStore } from 'zustand';
import { conflictStore } from './conflict';
import { lastChangeText } from './sync';

export function ConflictHost() {
  const request = useStore(conflictStore, (s) => s.request);
  if (!request) return null;
  return (
    <div className="dialog-backdrop">
      <div className="dialog conflict-dialog" role="dialog" aria-modal="true" aria-label="Dwie wersje zina">
        <p>
          Zin „{request.title}” zmienił się na Dysku Google, a tutaj też są zmiany, których tam jeszcze nie ma.
          Którą wersję zostawić?
        </p>
        <p className="muted">{lastChangeText(request.change)}</p>
        <div className="conflict-choices">
          <button type="button" onClick={() => request.answer('theirs')}>
            <strong>Weź wersję z Dysku</strong>
            <span className="muted">Zmiany zrobione tutaj przepadną.</span>
          </button>
          <button type="button" onClick={() => request.answer('mine')}>
            <strong>Zostaw moją</strong>
            <span className="muted">Wersja z Dysku zostanie nadpisana.</span>
          </button>
          <button type="button" className="primary" autoFocus onClick={() => request.answer('copy')}>
            <strong>Zapisz moją jako kopię</strong>
            <span>Moja wersja będzie osobnym zinem, a ten weźmie wersję z Dysku. Nic nie przepadnie.</span>
          </button>
        </div>
        <div className="dialog-buttons">
          <button type="button" onClick={() => request.answer(null)}>
            Nie teraz
          </button>
        </div>
      </div>
    </div>
  );
}
