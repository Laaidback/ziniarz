import { useStore } from 'zustand';
import { dismissNotice, noticeStore } from './notices';

export function NoticeList() {
  const notices = useStore(noticeStore, (s) => s.notices);
  if (notices.length === 0) return null;
  return (
    <div className="notices">
      {notices.map((notice) => (
        <div key={notice.id} className="notice" role="alert">
          <span>{notice.text}</span>
          <button type="button" aria-label="Zamknij komunikat" onClick={() => dismissNotice(notice.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
