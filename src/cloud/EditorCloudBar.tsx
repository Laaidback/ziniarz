import { CloudStatusLine } from './CloudStatusLine';
import type { EditorCloud } from './useEditorCloudSync';

/** The editor top bar's Drive part: "save to Drive", or the status of a zine saved there. */
export function EditorCloudBar({ zineId, editorCloud }: { zineId: string; editorCloud: EditorCloud }) {
  const { cloud, linked } = editorCloud;
  if (linked === null) return null;
  if (!linked) {
    return (
      <button
        type="button"
        onPointerEnter={cloud.prepare}
        onFocus={cloud.prepare}
        onClick={() => void editorCloud.saveToDrive()}
        title="Zapisz tego zina na Dysku Google, żeby otworzyć go na innym komputerze albo udostępnić"
      >
        Zapisz na Dysku
      </button>
    );
  }
  return <CloudStatusLine zineId={zineId} onAction={(action) => void editorCloud.act(action)} />;
}
