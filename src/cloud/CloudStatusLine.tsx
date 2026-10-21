import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { useSignedIn } from './CloudContext';
import { cloudStatusStore } from './cloudStatus';
import { ACTION_LABELS, cloudStatusView, type CloudStatusAction } from './statusText';

/** A linked zine's Drive status with the button that helps, if any (editor top bar, zine card). */
export function CloudStatusLine({ zineId, onAction }: { zineId: string; onAction(action: CloudStatusAction): void }) {
  const status = useStore(cloudStatusStore, (s) => s.zines[zineId]);
  const signedIn = useSignedIn();
  // "10 min temu" moves on by itself.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const view = cloudStatusView(status, signedIn, now);
  return (
    <div className="cloud-status" data-tone={view.tone}>
      <span className="cloud-status-text" role="status" title={view.detail || undefined}>
        {view.text}
      </span>
      {view.action && (
        <button type="button" onClick={() => onAction(view.action!)}>
          {ACTION_LABELS[view.action]}
        </button>
      )}
    </div>
  );
}
