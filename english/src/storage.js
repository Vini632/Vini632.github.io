let db;
export async function openStore() {
  db = await new Promise((resolve, reject) => {
    const req = indexedDB.open("worldforge-english", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("workspace");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () =>
      reject(new Error("Feche outras abas do English e tente novamente."));
  });
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspace", "readonly");
    const req = tx.objectStore("workspace").get("state");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export function writeStore(state) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspace", "readwrite");
    tx.objectStore("workspace").put(structuredClone(state), "state");
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error || new Error("Não foi possível salvar."));
  });
}
export const escapeHTML = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
