import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './app/app.css';
import { registerBuiltinFonts } from './fonts/fontLoader';

registerBuiltinFonts();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
