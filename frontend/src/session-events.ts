const listeners = new Set<() => void>();
export function subscribeSession(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function notifySession() { listeners.forEach(listener => listener()); }
