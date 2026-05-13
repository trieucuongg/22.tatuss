// URL của Google Apps Script
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbze5byhjvgs4WssT1dpEbCxFIgzp3IsjttmdQaWpxxAZvND7sS-_32VfX75Im3diDiJ/exec';

// TTL cache: 5 phút (ms)
const CACHE_TTL = 5 * 60 * 1000;

let localTimestamp = null;

export async function fetchFromAPI(action, params = {}) {
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.append('action', action);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, value);
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error('Lỗi khi fetch API:', error);
    return null;
  }
}

// ============================================================
// Cache helpers với TTL — tự hết hạn sau CACHE_TTL
// ============================================================

function setCache(key, data) {
  localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
}

function getCache(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) {
      localStorage.removeItem(key);
      return null; // Cache đã hết hạn
    }
    return data;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function clearCache() {
  // Chỉ xóa cache của lookbook, không xóa dữ liệu khác
  Object.keys(localStorage)
    .filter(k => k.startsWith('lookbook_'))
    .forEach(k => localStorage.removeItem(k));
}

// ============================================================
// Auto-update: so sánh timestamp với server
// ============================================================

export async function checkForUpdates() {
  const serverTimestamp = await fetchFromAPI('getLastUpdated');

  // Lần đầu tải trang
  if (localTimestamp === null) {
    localTimestamp = serverTimestamp;
    return false;
  }

  // Nếu phát hiện timestamp mới → xóa cache và yêu cầu render lại
  if (serverTimestamp && String(serverTimestamp) !== String(localTimestamp)) {
    localTimestamp = serverTimestamp;
    clearCache();
    return true;
  }

  return false;
}

// ============================================================
// API Functions — có TTL cache
// ============================================================

export async function getCategories() {
  const cached = getCache('lookbook_categories');
  if (cached) return cached;

  const data = await fetchFromAPI('getCategories');
  if (data) setCache('lookbook_categories', data);
  return data;
}

export async function getProducts(category = 'all') {
  const cacheKey = `lookbook_products_${category}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const data = await fetchFromAPI('getProducts', { category });
  if (data) setCache(cacheKey, data);
  return data;
}

export async function getSiteInfo() {
  const cached = getCache('lookbook_site_info');
  if (cached) return cached;

  const data = await fetchFromAPI('getSiteInfo');
  if (data) setCache('lookbook_site_info', data);
  return data;
}
