export async function loadComponent(elementId, filePath) {
  try {
    const res = await fetch(filePath);
    if (res.ok) {
      const html = await res.text();
      const el = document.getElementById(elementId);
      if (el) el.outerHTML = html;
    } else {
      console.error(`Komponen ${filePath} tidak ditemukan.`);
    }
  } catch (err) {
    console.error(`Gagal memuat komponen ${filePath}:`, err);
  }
}
