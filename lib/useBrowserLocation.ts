'use client';
import { useSyncExternalStore } from 'react';
function subscribe(notify: () => void) {
  window.addEventListener('popstate', notify);
  window.addEventListener('hashchange', notify);
  return () => { window.removeEventListener('popstate', notify); window.removeEventListener('hashchange', notify); };
}
const snapshot = () => window.location.href;
const serverSnapshot = () => '';
export function useBrowserLocation() { return useSyncExternalStore(subscribe, snapshot, serverSnapshot); }
