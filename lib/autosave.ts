export type SaveState = 'pending' | 'saved' | 'failed';

// One writer, latest-edit acknowledgements, and an explicit flush for navigation.
export function createAutosave<T>(write: (value: T) => Promise<unknown>, onState: (state: SaveState) => void, delayMs = 500) {
 let revision = 0, queued = 0, notifying = true;
 let latest: {revision: number; value: T} | null = null;
 let timer: ReturnType<typeof setTimeout> | undefined;
 let tail: Promise<unknown> = Promise.resolve();
 const inFlight = new Set<number>();
 const notify = (state: SaveState) => { if (notifying) onState(state); };
 function clearTimer() { if (timer !== undefined) clearTimeout(timer); timer = undefined; }
 function enqueue(entry: {revision: number; value: T}) {
  queued++; inFlight.add(entry.revision);
  const task = tail.catch(() => {}).then(() => write(entry.value));
  tail = task;
  void task.then(() => {
   queued--; inFlight.delete(entry.revision);
   if (latest?.revision === entry.revision) { latest = null; notify('saved'); }
  }, () => {
   queued--; inFlight.delete(entry.revision);
   if (latest?.revision === entry.revision) notify('failed');
  });
  return task;
 }
 function flush() {
  clearTimer();
  return latest && !inFlight.has(latest.revision) ? enqueue(latest) : tail;
 }
 return {
  stage(value: T) {
   clearTimer(); latest = {revision: ++revision, value}; notify('pending');
   timer = setTimeout(() => { timer = undefined; void flush().catch(() => {}); }, delayMs);
  },
  save(value: T) {
   clearTimer(); latest = {revision: ++revision, value}; notify('pending');
   return enqueue(latest);
  },
  flush,
  settle: () => tail,
  pending: () => latest !== null || queued > 0,
  cancelPending() { clearTimer(); latest = null; revision++; },
  setNotifications(enabled: boolean) { notifying = enabled; }
 };
}
