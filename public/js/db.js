// IndexedDB Helper untuk Offline POS Transactions
const DB_NAME = 'posta_pos_db';
const DB_VERSION = 1;
const STORE_NAME = 'offline_transactions';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflineTransaction(transactionPayload) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  const localId = 'OFFLINE-' + Date.now();
  const offlineItem = {
    id: localId,
    payload: transactionPayload,
    created_at: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const request = store.add(offlineItem);
    request.onsuccess = () => resolve(offlineItem);
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineTransactions() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function removeOfflineTransaction(id) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// Sinkronisasi otomatis saat internet kembali tersambung
export async function syncOfflineTransactions(apiClient, showToastCallback) {
  try {
    const pendingList = await getOfflineTransactions();
    if (!pendingList || pendingList.length === 0) return;

    if (showToastCallback) {
      showToastCallback(`Sedang menyinkronkan ${pendingList.length} transaksi offline...`, 'info');
    }

    for (const item of pendingList) {
      try {
        const res = await apiClient.post('/api/checkout', item.payload);
        if (res && res.success) {
          await removeOfflineTransaction(item.id);
        }
      } catch (err) {
        console.error('Gagal sinkron transaksi id:', item.id, err);
      }
    }

    const remaining = await getOfflineTransactions();
    if (remaining.length === 0 && showToastCallback) {
      showToastCallback('Semua transaksi offline berhasil tersinkron ke server!', 'success');
    }
  } catch (err) {
    console.error('Sync Error:', err);
  }
}
