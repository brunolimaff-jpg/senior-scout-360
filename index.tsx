import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

/**
 * DIAGNÓSTICO: Toggle para desativar o StrictMode do React.
 * O StrictMode pode causar execuções duplas de useEffects e chamadas de API em desenvolvimento,
 * o que dificulta a depuração de concorrência em pipelines assíncronos.
 */
const DISABLE_STRICT_MODE_FOR_DEBUG = true;

const root = ReactDOM.createRoot(rootElement);

if (DISABLE_STRICT_MODE_FOR_DEBUG) {
  // Renderização direta para evitar dupla execução de ciclo de vida
  root.render(<App />);
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}