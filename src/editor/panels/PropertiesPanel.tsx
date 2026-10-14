import { useEditor } from '../EditorContext';
import { selectedElement } from '../state/store';
import { PagePanel } from './PagePanel';
import { PhotoPanel } from './PhotoPanel';
import { TextPanel } from './TextPanel';
import { ZinePanel } from './ZinePanel';

/** Right column: the selected element's settings, or the clicked page's and the zine's. */
export function PropertiesPanel() {
  const element = useEditor(selectedElement);
  const activePage = useEditor((s) => s.activePage);
  if (element?.kind === 'photo') return <PhotoPanel element={element} />;
  if (element?.kind === 'text') return <TextPanel element={element} />;
  return (
    <>
      {activePage !== null && <PagePanel page={activePage} />}
      <ZinePanel />
    </>
  );
}
