const SESSION_EVENT_KEY = 'polubu-session-change-v1';
const LOCAL_EVENT = 'polubu:session-change';
export type SessionChange = 'changing' | 'changed';

/** Signals carry no identity, credentials or permissions. Receivers discard cached
 * data and ask the server again; a signal alone can never grant workspace access. */
export function announceSessionChange(change: SessionChange) {
  window.dispatchEvent(new CustomEvent(LOCAL_EVENT, { detail: change }));
  try {
    localStorage.setItem(SESSION_EVENT_KEY, JSON.stringify({ change, nonce: crypto.randomUUID() }));
  } catch {
    /* Focus/visibility refresh still works when browser storage is unavailable. */
  }
}

export function subscribeSessionChanges(listener: (change: SessionChange) => void) {
  const onLocal = (event: Event) => {
    if (event instanceof CustomEvent && (event.detail === 'changing' || event.detail === 'changed'))
      listener(event.detail);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== SESSION_EVENT_KEY || !event.newValue) return;
    try {
      const data: unknown = JSON.parse(event.newValue);
      if (
        data &&
        typeof data === 'object' &&
        'change' in data &&
        (data.change === 'changing' || data.change === 'changed')
      )
        listener(data.change);
    } catch {
      /* Ignore unrelated/malformed hints; never treat them as Auth state. */
    }
  };
  window.addEventListener(LOCAL_EVENT, onLocal);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(LOCAL_EVENT, onLocal);
    window.removeEventListener('storage', onStorage);
  };
}
