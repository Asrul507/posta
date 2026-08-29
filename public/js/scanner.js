import { state, formatRupiah, showToast } from './state.js';
import { playBeepSound, triggerVisualFlash } from './audio.js';
import { addToCart } from './views/pos.js';
import { renderPOTable, openNewItemModal } from './views/po.js';

let codeReader = null;
let currentScanTarget = 'CASHIER';
let lastScannedCode = '';
let lastScanTimestamp = 0;

export function processBarcodeScanned(rawBarcode, target = 'CASHIER', source = 'CAMERA') {
  const now = Date.now();
  const cleanCode = String(rawBarcode).trim().toLowerCase();

  if (cleanCode === lastScannedCode && (now - lastScanTimestamp) < 1200) return;
  lastScannedCode = cleanCode;
  lastScanTimestamp = now;

  const found = state.products.find(p => {
    const pBarcode = p.barcode ? String(p.barcode).trim().toLowerCase() : '';
    const pName = p.name ? String(p.name).trim().toLowerCase() : '';
    return pBarcode === cleanCode || pName === cleanCode;
  });

  if (target === 'CASHIER') {
    if (!found) {
      playBeepSound('error');
      updateScannerInfoCard(`❌ Barcode "${rawBarcode}" Tidak Ditemukan`, 'Periksa master data produk!', true);
      showToast(`Barcode "${rawBarcode}" tidak terdaftar`, 'error');
      return;
    }

    if (found.stock <= 0) {
      playBeepSound('error');
      updateScannerInfoCard(`❌ Stok "${found.name}" Habis!`, 'Stok di database 0', true);
      showToast(`Stok ${found.name} habis!`, 'error');
      return;
    }

    const existing = state.cart.find(c => c.id === found.id);
    if (existing && existing.qty >= found.stock) {
      playBeepSound('error');
      updateScannerInfoCard(`⚠️ Stok Maksimum Tercapai`, `${found.name} sisa ${found.stock} pcs`, true);
      showToast(`Stok ${found.name} hanya tersisa ${found.stock}`, 'error');
      return;
    }

    addToCart(found.id);
    playBeepSound('success');
    triggerVisualFlash();

    const curQty = existing ? existing.qty : 1;
    updateScannerInfoCard(`✅ ${found.name}`, `${formatRupiah(found.price)} (Qty: ${curQty})`);
    return;
  }

  if (target === 'PO') {
    if (found) {
      const existingInPO = state.poItems.find(item => item.id === found.id);
      if (existingInPO) {
        existingInPO.qty += 1;
      } else {
        state.poItems.push({
          id: found.id,
          name: found.name,
          barcode: found.barcode,
          cost_price: found.cost_price || 0,
          qty: 1,
          is_new: false
        });
      }
      renderPOTable();
      playBeepSound('success');
      triggerVisualFlash();
      updateScannerInfoCard(`✅ ${found.name}`, `+1 Masuk (Total: ${existingInPO ? existingInPO.qty : 1} pcs)`);
    } else {
      playBeepSound('error');
      if (source === 'CAMERA') closeContinuousCamera();
      openNewItemModal(rawBarcode);
    }
  }
}

export function updateScannerInfoCard(title, subtitle, isError = false) {
  const card = document.getElementById('scanner-last-item');
  const countLabel = document.getElementById('scanner-item-count');
  if (card) card.innerHTML = `<div class="${isError ? 'text-rose-400' : 'text-emerald-400'} font-bold">${title}</div><div class="text-[10px] text-slate-400">${subtitle}</div>`;
  
  const total = currentScanTarget === 'PO' 
    ? state.poItems.reduce((a, b) => a + b.qty, 0) 
    : state.cart.reduce((a, b) => a + b.qty, 0);
  if (countLabel) countLabel.innerText = `Total: ${total} Item`;
}

export async function openContinuousCamera(target = 'CASHIER') {
  currentScanTarget = target;
  document.getElementById('scanner-title').innerText = target === 'CASHIER' 
    ? 'Mode Scan Beruntun (Kasir)' 
    : 'Mode Scan Beruntun (Barang Masuk)';
  
  document.getElementById('scanner-last-item').innerText = 'Arahkan garis merah melintang di atas barcode...';
  
  const total = currentScanTarget === 'PO' ? state.poItems.reduce((a, b) => a + b.qty, 0) : state.cart.reduce((a, b) => a + b.qty, 0);
  document.getElementById('scanner-item-count').innerText = `Total: ${total} Item`;
  document.getElementById('camera-modal').classList.remove('hidden');

  if (codeReader) {
    try { codeReader.reset(); } catch (e) {}
  }

  const hints = new Map();
  const formats = [
    ZXing.BarcodeFormat.EAN_13,
    ZXing.BarcodeFormat.EAN_8,
    ZXing.BarcodeFormat.CODE_128,
    ZXing.BarcodeFormat.CODE_39,
    ZXing.BarcodeFormat.UPC_A,
    ZXing.BarcodeFormat.UPC_E,
    ZXing.BarcodeFormat.QR_CODE
  ];
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
  hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

  codeReader = new ZXing.BrowserMultiFormatReader(hints);

  try {
    const videoInputDevices = await codeReader.listVideoInputDevices();
    let selectedDeviceId = undefined;
    if (videoInputDevices.length > 0) {
      const backCam = videoInputDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') || 
        device.label.toLowerCase().includes('environment')
      );
      selectedDeviceId = backCam ? backCam.deviceId : videoInputDevices[videoInputDevices.length - 1].deviceId;
    }

    await codeReader.decodeFromVideoDevice(selectedDeviceId, 'camera-video', (result) => {
      if (result) {
        processBarcodeScanned(result.getText(), currentScanTarget, 'CAMERA');
      }
    });
  } catch (err) {
    showToast("Gagal mengakses kamera.", "error");
    closeContinuousCamera();
  }
}

export function closeContinuousCamera() {
  document.getElementById('camera-modal').classList.add('hidden');
  if (codeReader) {
    try { codeReader.reset(); } catch (e) {}
  }
}

export function initHardwareScannerListener() {
  let barcodeBuffer = '';
  let lastKeyTime = Date.now();

  window.addEventListener('keydown', (e) => {
    const activeTag = document.activeElement ? document.activeElement.tagName : '';
    const activeId = document.activeElement ? document.activeElement.id : '';
    if (activeTag === 'INPUT' && activeId !== 'search-input' && activeId !== 'po-search-input') return;

    const currentTime = Date.now();
    if (currentTime - lastKeyTime > 120) barcodeBuffer = '';
    lastKeyTime = currentTime;

    if (e.key === 'Enter') {
      if (barcodeBuffer.length >= 3) {
        e.preventDefault();
        const poModal = document.getElementById('po-modal');
        const target = !poModal.classList.contains('hidden') ? 'PO' : 'CASHIER';
        processBarcodeScanned(barcodeBuffer.trim(), target, 'HARDWARE');
        barcodeBuffer = '';
      }
    } else if (e.key.length === 1) {
      barcodeBuffer += e.key;
    }
  });
}
