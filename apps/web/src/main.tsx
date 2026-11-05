import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');
const root = createRoot(container);

async function boot(): Promise<void> {
  if (import.meta.env.VITE_DEMO) {
    // גרסת דמו: שרת מדומה בדפדפן + ניתוב בזיכרון. חייב לרוץ לפני טעינת ה־stores.
    const { bootstrapDemo } = await import('./demo/bootstrap');
    bootstrapDemo();
    const { DemoRoot } = await import('./demo/DemoRoot');
    root.render(
      <StrictMode>
        <DemoRoot />
      </StrictMode>,
    );
    return;
  }
  const [{ BrowserRouter }, { default: App }] = await Promise.all([import('react-router'), import('./App')]);
  root.render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
}

void boot();
