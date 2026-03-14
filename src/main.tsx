import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// One-time migration: rename quarry-* keys to db-explorer-*
function migrateLocalStorage() {
  const exact: [string, string][] = [
    ['quarry-shown-databases', 'db-explorer-shown-databases'],
    ['quarry-tabs',            'db-explorer-tabs'],
    ['quarry-active-tab',      'db-explorer-active-tab'],
    ['quarry-sidebar',         'db-explorer-sidebar'],
    ['quarry-settings',        'db-explorer-settings'],
  ];
  for (const [oldKey, newKey] of exact) {
    const val = localStorage.getItem(oldKey);
    if (val !== null) {
      if (localStorage.getItem(newKey) === null) localStorage.setItem(newKey, val);
      localStorage.removeItem(oldKey);
    }
  }

  const prefixes: [string, string][] = [
    ['quarry-table-state',  'db-explorer-table-state'],
    ['query-editor-ratio-', 'db-explorer-editor-ratio-'],
  ];
  const allKeys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!).filter(Boolean);
  for (const key of allKeys) {
    for (const [oldPrefix, newPrefix] of prefixes) {
      if (key.startsWith(oldPrefix)) {
        const newKey = newPrefix + key.slice(oldPrefix.length);
        const val = localStorage.getItem(key);
        if (val !== null && localStorage.getItem(newKey) === null) localStorage.setItem(newKey, val);
        localStorage.removeItem(key);
        break;
      }
    }
  }
}

migrateLocalStorage();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
