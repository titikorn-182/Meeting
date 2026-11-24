'use client';
import { useSyncExternalStore } from 'react';
const eventName = 'polubu:list-filter';
function subscribe(listener: () => void) {
  window.addEventListener('popstate', listener);
  window.addEventListener(eventName, listener);
  return () => {
    window.removeEventListener('popstate', listener);
    window.removeEventListener(eventName, listener);
  };
}
function snapshot() {
  return window.location.search;
}
function serverSnapshot() {
  return '';
}
/** Keep list state in the URL so reload, shared links and browser Back retain context. */
export function useUrlFilter(key: string, fallback: string): [string, (value: string) => void] {
  const search = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const value = new URLSearchParams(search).get(key)?.slice(0, 500) ?? fallback;
  function setValue(next: string) {
    const url = new URL(window.location.href);
    url.searchParams.set(key, next.slice(0, 500));
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    window.dispatchEvent(new Event(eventName));
  }
  return [value, setValue];
}
