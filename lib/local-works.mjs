// Finished media is stored only after an explicit click, in this browser's IndexedDB.
export function createLocalWorkStore({ indexedDB = globalThis.indexedDB, scope = 'guest' } = {}) {
 const DB = 'voicegram-local-works-v1', LIMIT = 30, BYTES = 100 * 1024 * 1024, FILE_BYTES = 25 * 1024 * 1024;
 let opening;
 const unavailable = () => Error('이 브라우저에서는 작품을 보관할 수 없어요. 파일 저장을 이용해주세요.');
 function open() {
  if (!indexedDB) return Promise.reject(unavailable());
  if (!opening) opening = new Promise((resolve, reject) => {
   let request;
   try { request = indexedDB.open(DB, 1); } catch { reject(unavailable()); return; }
   request.onupgradeneeded = () => {
    request.result.createObjectStore('works', { keyPath: ['scope', 'id'] });
    request.result.createObjectStore('files', { keyPath: ['scope', 'id'] });
   };
   let blocked = false;
   request.onblocked = () => { blocked = true; reject(Error('다른 보이스그램 창을 닫고 다시 시도해주세요.')); };
   request.onerror = () => reject(unavailable());
   request.onsuccess = () => {
    if (blocked) { request.result.close(); return; }
    const db = request.result;
    db.onversionchange = () => { db.close(); opening = null; };
    db.onclose = () => { opening = null; };
    resolve(db);
   };
  }).catch(error => { opening = null; throw error; });
  return opening;
 }
 async function run(mode, action) {
  const db = await open();
  return new Promise((resolve, reject) => {
   let tx, result, failure;
   try { tx = db.transaction(['works', 'files'], mode); }
   catch { reject(unavailable()); return; }
   tx.oncomplete = () => resolve(result);
   tx.onabort = () => reject(failure || Error(tx.error?.name === 'QuotaExceededError' ? '기기 저장 공간이 부족해요. 파일로 저장한 뒤 필요 없는 보관 작품을 지워주세요.' : '작품 보관에 실패했어요. 파일 저장을 이용해주세요.'));
   tx.onerror = () => {}; // onabort reports failures; success requires the entire transaction to commit.
   try { action(tx, value => { result = value; }, error => { failure = error; tx.abort(); }); }
   catch (error) { failure = error; tx.abort(); }
  });
 }
 function validId(id) { return typeof id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(id); }
 return {
  limits: { count: LIMIT, bytes: BYTES, fileBytes: FILE_BYTES },
  async save({ id, title, kind, blob }) {
   if (!validId(id) || !['image','video'].includes(kind) || !(blob instanceof Blob) || !blob.size || blob.size > FILE_BYTES ||
       !(kind === 'image' ? blob.type === 'image/png' : /^video\/(mp4|webm|quicktime)(;|$)/.test(blob.type))) throw Error('보관할 파일을 확인해주세요. PNG 카드 또는 25MB 이하 MP4·MOV·WebM 영상만 보관할 수 있어요.');
   return run('readwrite', (tx, finish, fail) => {
    const works = tx.objectStore('works'), req = works.getAll();
    req.onsuccess = () => {
     const previous = req.result.find(x => x.scope === scope && x.id === id);
     if (previous) {
      // An export ID is immutable: repeated taps cannot duplicate or overwrite it.
      finish(previous); return;
     }
     if (req.result.length >= LIMIT || req.result.reduce((sum, x) => sum + x.size, 0) + blob.size > BYTES) {
      fail(Error('보관함이 가득 찼어요. 최대 30개·100MB까지 보관해요. 파일로 저장한 뒤 필요 없는 작품을 지워주세요.')); return;
     }
     const item = { scope, id, title: String(title || '내 작품').slice(0, 80), kind, mime: blob.type, size: blob.size, created: Date.now() };
     works.add(item); tx.objectStore('files').add({ scope, id, blob }); finish(item);
    };
   });
  },
  list() { return run('readonly', (tx, finish) => { const req = tx.objectStore('works').getAll(); req.onsuccess = () => finish(req.result.filter(x => x.scope === scope).sort((a,b) => b.created - a.created)); }); },
  async get(id) {
   if (!validId(id)) return null;
   return run('readonly', (tx, finish) => {
    const meta = tx.objectStore('works').get([scope, id]), file = tx.objectStore('files').get([scope, id]);
    file.onsuccess = () => finish(meta.result && file.result ? { ...meta.result, blob: file.result.blob } : null);
   });
  },
  async remove(id) {
   if (!validId(id)) return;
   return run('readwrite', (tx) => { tx.objectStore('works').delete([scope, id]); tx.objectStore('files').delete([scope, id]); });
  },
  clear() {
   return run('readwrite', tx => {
    const req = tx.objectStore('works').getAll();
    req.onsuccess = () => { for (const item of req.result) if (item.scope === scope) {
     tx.objectStore('works').delete([scope, item.id]);
     tx.objectStore('files').delete([scope, item.id]);
    } };
   });
  },
  async close() { if (opening) { const db = await opening; db.close(); opening = null; } }
 };
};

