import { useRef } from 'react';
import { errorMessage, notify } from '../app/notices';
import { useEditorEnv } from './EditorContext';
import { insertPhotos, insertText } from './insert';

export function InsertButtons() {
  const env = useEditorEnv();
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
          if (files.length) insertPhotos(env, files, null).catch((error) => notify(errorMessage(error)));
        }}
      />
      <button type="button" onClick={() => insertText(env.store)}>
        + Napis
      </button>
    </div>
  );
}
