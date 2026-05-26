import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Catch and suppress benign Vite WebSocket / HMR connection errors
if (typeof window !== "undefined") {
  const isWebsocketError = (err: any): boolean => {
    if (!err) return false;
    const msg = typeof err === "string" ? err : String(err.message || err.reason || err);
    return (
      msg.includes("WebSocket") || 
      msg.includes("websocket") || 
      msg.includes("HMR") || 
      msg.includes("vite") || 
      msg.includes("ws://") || 
      msg.includes("wss://")
    );
  };

  window.addEventListener("unhandledrejection", (event) => {
    if (isWebsocketError(event.reason)) {
      event.preventDefault();
      event.stopPropagation();
      console.warn("Benign WebSocket/HMR rejection suppressed:", event.reason);
    }
  });

  window.addEventListener("error", (event) => {
    if (isWebsocketError(event.message) || isWebsocketError(event.error)) {
      event.preventDefault();
      event.stopPropagation();
      console.warn("Benign WebSocket/HMR error suppressed:", event.message);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
