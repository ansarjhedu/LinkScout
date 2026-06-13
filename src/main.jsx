import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App';
import './index.css';

/**
 * Entry point for the MaxOpp Intelligence Crawler application.
 * Mounts the core App component within a React 18 concurrent root.
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);