import { state, showToast } from './state.js';
import { addToCart } from './views/pos.js';
import { handleAddPOByBarcode } from './views/po.js';

let barcodeBuffer = '';
let lastKeyTime = 0;
let codeReader = null;
let currentScannerMode = 'CASHIER';

// Inisialisasi Hardware Scanner (USB / Wireless Scanner)
export function initHardwareScannerListener() {
  document.addEventListener('keydown', (e) => {
    // Jangan tangkap scanner jika user sedang mengetik di form input / textarea biasa
    const target = e.target;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    
    // Pengecualian untuk input search barcode di PO
    const isPOSearch = target && target.id === 'po-search-input';
    if (isInput && !isPOSearch) return;

    const currentTime = Date.now();
    
    // Scanner mengirim karakter sangat cepat (< 50ms per keystroke)
    if (currentTime - lastKeyTime > 100) {
      barcodeBuffer = '';
    }
    lastKeyTime = currentTime;

    if (e.key === 'Enter') {
      if (barcodeBuffer && barcodeBuffer.length >= 3) {
        e.preventDefault();
        processScannedBarcode(barcodeBuffer.trim());
        barcodeBuffer = '';
      }
    } else if (e.key && e.key.length === 1) {
      barcodeBuffer += e.key;
    }
  });
}

// Proses Hasil Barcode
export function processScannedBarcode(barcode) {
  if (!barcode) return;

  if (currentScannerMode === 'PO') {
    if (typeof handleAddPOByBarcode === 'function') {
      handleAddPOByBarcode(barcode);
    }
    return;
  }

  // Default: Mode Kasir (POS)
  if (!state.products || !Array.isArray(state.products)) return;

  const product = state.products.find(p => p.barcode === barcode || String(p.id) === barcode);
  if (product) {
    addToCart(product.id);
    showToast(`Ditambahkan: ${product.name}`);
    
    // Update feedback modal kamera jika sedang terbuka
    const lastItemEl = document.getElementById('scanner-last-item');
    if (lastItemEl) {
      lastItemEl.innerHTML = `<span class="text-emerald-400 font-bold">${product.name}</span> (+1)`;
    }
  } else {
    showToast(`Barcode ${barcode} tidak terdaftar!`, 'error');
  }
}

// Buka Kamera Scanner Beruntun
export async function openContinuousCamera(mode = 'CASHIER') {
  currentScannerMode = mode;
  const modal = document.getElementById('camera-modal');
  const title = document.getElementById('scanner-title');
  if (title) {
    title.innerText = mode === 'PO' ? 'Scan Barcode Penerimaan Barang (PO)' : 'Mode Scan Beruntun (Kasir)';
  }
  if (modal) modal.classList.remove('hidden');

  try {
    if (!window.ZXing) {
      showToast('Library scanner belum siap', 'error');
      return;
    }

    if (!codeReader) {
      codeReader = new window.ZXing.BrowserMultiFormatReader();
    }

    const videoInputDevices = await codeReader.listVideoInputDevices();
    if (!videoInputDevices || videoInputDevices.length === 0) {
      showToast('Tidak ada kamera terdeteksi', 'error');
      return;
    }

    // Prioritaskan kamera belakang (environment)
    const selectedDeviceId = videoInputDevices.find(d => /back|rear|environment/i.test(d.label))?.deviceId || videoInputDevices[0].deviceId;

    await codeReader.decodeFromVideoDevice(selectedDeviceId, 'camera-video', (result, err) => {
      if (result && result.getText()) {
        const scannedText = result.getText();
        
        // Mencegah scan berulang dalam 1 detik untuk barcode yang sama
        if (state.lastScannedCode === scannedText && (Date.now() - state.lastScannedTime < 1200)) {
          return;
        }
        state.lastScannedCode = scannedText;
        state.lastScannedTime = Date.now();

        // Animasi visual feedback
        const feedback = document.getElementById('scanner-feedback');
        if (feedback) {
          feedback.classList.add('border-emerald-500');
          setTimeout(() => feedback.classList.remove('border-emerald-500'), 300);
        }

        processScannedBarcode(scannedText);
      }
    });
  } catch (err) {
    console.error("Camera Scanner Error:", err);
    showToast('Gagal mengakses kamera', 'error');
  }
}

// Tutup Kamera
export function closeContinuousCamera() {
  const modal = document.getElementById('camera-modal');
  if (modal) modal.classList.add('hidden');
  if (codeReader) {
    try {
      codeReader.reset();
    } catch (_) {}
  }
}

window.openContinuousCamera = openContinuousCamera;
window.closeContinuousCamera = closeContinuousCamera;
