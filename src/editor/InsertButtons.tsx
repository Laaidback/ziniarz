import { useRef } from 'react';
import { useEditorEnv } from './EditorContext';
import { insertText } from './insert';
import { insertProgressText, usePhotoInsert } from './photoInsert';

export function InsertButtons() {
  const { store } = useEditorEnv();
  const photos = usePhotoInsert();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="toolbar">
      <button type="button" onClick={() => input.current?.click()}>
        + Zdjęcie
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label="Wybierz zdjęcia"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = '';
          if (files.length) photos.add(files, null);
        }}
      />
      <button type="button" onClick={() => insertText(store)}>
        + Napis
      </button>
      {photos.progress && (
        <span className="muted" role="status">
          {insertProgressText(photos.progress)}
        </span>
      )}
    </div>
  );
}
