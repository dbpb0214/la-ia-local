import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App.jsx';
import '@/index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

// Dev-only translation harness (stripped from production builds): /#translate-harness, then reload.
if (import.meta.env.DEV && location.hash === '#translate-harness') {
  import('@/translation/Harness.jsx').then(({ default: Harness }) => root.render(<Harness />));
} else {
  root.render(<App />);
}
