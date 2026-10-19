import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './app/app.css';
import { registerBuiltinFonts } from './fonts/fontLoader';
import { detectSystemFonts } from './fonts/systemFonts';

registerBuiltinFonts();
void detectSystemFonts(); // Ayuthaya from macOS: new texts use it once found


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
