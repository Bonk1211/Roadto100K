import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';
import { TransferSessionProvider } from './lib/transfer-session';

registerSW({
  immediate: true,
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TransferSessionProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </TransferSessionProvider>
  </React.StrictMode>
);
