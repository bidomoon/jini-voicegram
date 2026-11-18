export class RequestError extends Error {
 constructor(message: string, public status?: number, public code?: string) { super(message); this.name = 'RequestError'; }
}
type Options = {request?: typeof fetch; timeoutMs?: number; timeoutMessage?: string};

// Never replay a write: a timeout can happen after the server committed it.
// Bound both headers and body reading, even if a fetch implementation ignores abort.
async function readWithinDeadline<T>(input: RequestInfo | URL, init: RequestInit, options: Options, read: (response: Response) => Promise<T>): Promise<T> {
 const controller = new AbortController(), request = options.request || fetch;
 let timer: ReturnType<typeof setTimeout> | undefined;
 let rejectCancelled: ((reason: unknown) => void) | undefined;
 const cancelled = new Promise<never>((_, reject) => { rejectCancelled = reject; });
 const abort = () => { controller.abort(); rejectCancelled?.(new DOMException('요청을 취소했어요.', 'AbortError')); };
 init.signal?.addEventListener('abort', abort, {once: true});
 if (init.signal?.aborted) abort();
 try {
  if (controller.signal.aborted) return await cancelled;
  const result = (async () => read(await request(input, {...init, signal: controller.signal})))();
  const timeout = new Promise<never>((_, reject) => {
   timer = setTimeout(() => {
    reject(new RequestError(options.timeoutMessage || '응답이 지연되고 있어요. 연결을 확인하고 다시 시도해주세요.', undefined, 'REQUEST_TIMEOUT'));
    controller.abort();
   }, options.timeoutMs ?? 20000);
  });
  return await Promise.race([result, timeout, cancelled]);
 } finally {
  if (timer !== undefined) clearTimeout(timer);
  init.signal?.removeEventListener('abort', abort);
 }
}
const errorMessage = (data: unknown) => data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : '요청을 완료하지 못했어요. 잠시 후 다시 시도해주세요.';

// AI requests need the original HTTP status and pending/unknown/failed state.
export function requestJSONResponse<T>(input: RequestInfo | URL, init: RequestInit = {}, options: Options = {}) {
 return readWithinDeadline(input, init, options, async response => {
  let data: unknown;
  try { data = await response.json(); }
  catch { throw new RequestError('서버 응답을 확인하지 못했어요. 연결을 확인하고 다시 시도해주세요.', response.ok ? undefined : response.status, 'INVALID_RESPONSE'); }
  return {response, data: data as T};
 });
}
export async function requestJSON<T>(input: RequestInfo | URL, init: RequestInit = {}, options: Options = {}): Promise<T> {
 const {response, data} = await requestJSONResponse<T>(input, init, options);
 if (!response.ok) throw new RequestError(errorMessage(data), response.status);
 return data;
}
export function requestBlob(input: RequestInfo | URL, init: RequestInit = {}, options: Options = {}) {
 return readWithinDeadline(input, init, options, async response => {
  if (!response.ok) {
   let data: unknown;
   try { data = await response.json(); } catch {}
   throw new RequestError(errorMessage(data), response.status);
  }
  return response.blob();
 });
}
