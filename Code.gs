const SPREADSHEET_ID = '1t7JekRn3LTDDKZJcbCXPGPnpUSo6OnZ-xmqvwhBsbtA';
const DRIVE_FOLDER_ID = '1ICtwsvEjk1P3qtlsqMwkoWT_y0orCqTX';

// ==========================================
// HELPERS DÙNG CHUNG
// ==========================================

/** Mở Spreadsheet */
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * Trả về sheet theo tên. Throw lỗi nếu không tồn tại.
 * @param {string} name
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet(name) {
  const sheet = getSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error(`Sheet không tồn tại: "${name}"`);
  return sheet;
}

/**
 * Đọc toàn bộ sheet → mảng object (header làm key).
 * @param {string} sheetName
 * @returns {Object[]}
 */
function getSheetData(sheetName) {
  const sheet = getSheet(sheetName);
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[String(h).trim()] = row[i]; });
    return obj;
  });
}

// ==========================================
// 1. CÀI ĐẶT BAN ĐẦU (Chạy 1 lần)
// ==========================================

/**
 * Tạo / định dạng lại sheet 'products' và 'site_config'.
 * Gọi hàm này một lần duy nhất khi khởi động hoặc reset.
 *
 * Cột products: product_id | name | category | description | drive_image_id | drive_gallery_ids | status
 * (Không còn cột 'price')
 */
function setupSheet() {
  const ss = getSpreadsheet();

  // ── Sheet: products ──────────────────────────
  let sheet = ss.getSheetByName('products');
  if (!sheet) sheet = ss.insertSheet('products');

  const PRODUCT_HEADERS = [
    'product_id', 'name', 'category', 'description',
    'drive_image_id', 'drive_gallery_ids', 'status'
  ];

  // Ghi header dòng 1
  const headerRange = sheet.getRange(1, 1, 1, PRODUCT_HEADERS.length);
  headerRange.setValues([PRODUCT_HEADERS])
             .setFontWeight('bold')
             .setBackground('#f3f3f3')
             .setFontColor('#333333');

  sheet.setFrozenRows(1);

  // Độ rộng cột cho dễ nhìn
  const colWidths = { 1:120, 2:200, 3:120, 4:300, 5:250, 6:250, 7:90 };
  Object.entries(colWidths).forEach(([col, w]) => sheet.setColumnWidth(Number(col), w));

  // Data validation cho cột status (G)
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['active', 'hidden'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 7, 500, 1).setDataValidation(statusRule);

  // ── Sheet: site_config ────────────────────────
  let configSheet = ss.getSheetByName('site_config');
  if (!configSheet) {
    configSheet = ss.insertSheet('site_config');
    configSheet.getRange(1, 1, 1, 2)
               .setValues([['key', 'value']])
               .setFontWeight('bold')
               .setBackground('#f3f3f3');

    configSheet.getRange(2, 1, 4, 2).setValues([
      ['last_updated',     new Date().getTime()],
      ['site_title',       '22.TATUSS'],
      ['collection_title', 'The Core Collection'],
      ['collection_desc',  'A curated selection of foundational pieces designed for effortless layering and timeless silhouette.']
    ]);

    configSheet.setColumnWidth(1, 160);
    configSheet.setColumnWidth(2, 420);
  }

  Logger.log("✅ setupSheet() hoàn tất — sheet 'products' & 'site_config' đã được định dạng.");
}

/**
 * MIGRATION: Xóa cột 'price' khỏi sheet 'products' nếu còn tồn tại.
 * Chạy một lần sau khi deploy Code.gs mới để dọn dẹp dữ liệu cũ.
 */
function migrateSheet() {
  const sheet   = getSheet('products');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const priceCol = headers.findIndex(h => String(h).trim().toLowerCase() === 'price');

  if (priceCol === -1) {
    Logger.log("ℹ️  Cột 'price' không tồn tại — không cần migrate.");
    return;
  }

  // deleteColumn nhận index 1-based
  sheet.deleteColumn(priceCol + 1);
  Logger.log(`✅ Đã xóa cột 'price' (cột ${priceCol + 1}) khỏi sheet 'products'.`);

  // Sau khi xóa, áp dụng lại định dạng header cho chắc
  setupSheet();
  Logger.log("✅ migrateSheet() hoàn tất.");
}

/**
 * Đọc tất cả ảnh trong DRIVE_FOLDER_ID và thêm vào sheet 'products'.
 * Chỉ thêm file chưa tồn tại (so sánh theo drive_image_id) để tránh duplicate.
 */
function syncImagesFromDrive() {
  const sheet  = getSheet('products');
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const files  = folder.getFiles();

  // Lấy danh sách ID đã có để tránh duplicate
  const existingData = sheet.getDataRange().getValues();
  const headers = existingData[0];
  const imgIdColIdx = headers.findIndex(h => String(h).trim() === 'drive_image_id');
  const existingIds = new Set(
    existingData.slice(1).map(row => String(row[imgIdColIdx] || '').trim()).filter(Boolean)
  );

  let rowIndex = sheet.getLastRow() + 1;
  let count = 0;
  let skipped = 0;

  while (files.hasNext()) {
    const file = files.next();
    if (!file.getMimeType().includes('image')) continue;

    const fileId = file.getId();
    if (existingIds.has(fileId)) { skipped++; continue; }

    const fileName  = file.getName().replace(/\.[^/.]+$/, '');
    const productId = 'PRD-' + String(Date.now()).slice(-5) + String(count).padStart(2, '0');

    sheet.getRange(rowIndex, 1, 1, 7).setValues([[
      productId, fileName, 'Baby Tee',
      'Sản phẩm mới thiết kế tối giản, hiện đại.',
      fileId, '', 'active'
    ]]);

    existingIds.add(fileId);
    rowIndex++;
    count++;
  }

  updateTimestamp();
  Logger.log(`✅ Đã sync ${count} ảnh mới | Bỏ qua ${skipped} ảnh đã tồn tại.`);
}

// ==========================================
// 2. TRIGGER & TIMESTAMP
// ==========================================

/** Trigger: tự động chạy khi người dùng sửa Sheet bằng tay */
function onEdit(e) {
  // Chỉ update timestamp khi sửa sheet 'products'
  if (e && e.source && e.source.getActiveSheet().getName() === 'products') {
    updateTimestamp();
  }
}

/** Ghi thời gian hiện tại vào 'last_updated' trong site_config */
function updateTimestamp() {
  const ss = getSpreadsheet();
  let configSheet = ss.getSheetByName('site_config');

  if (!configSheet) {
    configSheet = ss.insertSheet('site_config');
    configSheet.hideSheet();
    configSheet.appendRow(['last_updated', new Date().getTime()]);
    return;
  }

  const data   = configSheet.getDataRange().getValues();
  const rowIdx = data.findIndex(r => r[0] === 'last_updated');

  if (rowIdx >= 0) {
    configSheet.getRange(rowIdx + 1, 2).setValue(new Date().getTime());
  } else {
    configSheet.appendRow(['last_updated', new Date().getTime()]);
  }
}

// ==========================================
// 3. API — TRẢ DỮ LIỆU CHO WEBSITE & ADMIN
// ==========================================

/**
 * Entry point của Web App.
 * - Không có ?action → giao diện Admin CMS
 * - Có ?action       → JSON API cho Vite frontend
 *
 * Cache Apps Script (CacheService) 120s để giảm tải đọc Sheet liên tục.
 */
function doGet(e) {
  const action = e.parameter.action;

  if (!action) {
    return HtmlService.createHtmlOutputFromFile('Admin')
        .setTitle('Lookbook Admin CMS')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  const category = e.parameter.category || 'all';
  const cacheKey = `lookbook_${action}_${category}`;
  const cache    = CacheService.getScriptCache();

  // Trả về từ cache nếu còn hạn (120s)
  const cached = cache.get(cacheKey);
  if (cached) {
    return ContentService.createTextOutput(cached)
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Router dạng map — dễ mở rộng
  const handlers = {
    getProducts:    () => getProductsFromSheet(category),
    getCategories:  () => getCategoriesFromSheet(),
    getLastUpdated: () => getLastUpdatedTime(),   // KHÔNG cache để timestamp luôn mới
    getSiteInfo:    () => getSiteInfoFromSheet(),
  };

  let result;
  try {
    const handler = handlers[action];
    result = handler ? handler() : { error: `Action không hợp lệ: ${action}` };
  } catch (err) {
    result = { error: err.message };
  }

  const json = JSON.stringify(result);

  // Chỉ cache các action không phải getLastUpdated
  if (action !== 'getLastUpdated') {
    cache.put(cacheKey, json, 120); // cache 120 giây
  }

  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// 4. CÁC HÀM ĐỌC DỮ LIỆU (nội bộ)
// ==========================================

function getLastUpdatedTime() {
  try {
    const data = getSheet('site_config').getDataRange().getValues();
    const row  = data.find(r => r[0] === 'last_updated');
    return row ? row[1] : 0;
  } catch {
    return 0;
  }
}

function getSiteInfoFromSheet() {
  try {
    const data = getSheet('site_config').getDataRange().getValues();
    const info = {};
    data.slice(1).forEach(([key, value]) => {
      if (key && key !== 'last_updated') info[key] = value;
    });
    return info;
  } catch {
    return {};
  }
}

function getCategoriesFromSheet() {
  const products = getSheetData('products');
  const categories = [...new Set(
    products.map(p => String(p.category || '').trim()).filter(Boolean)
  )];
  return categories.length > 0 ? categories : ['Baby Tee', 'Boxy Tee'];
}

function getProductsFromSheet(filterCategory) {
  const products = getSheetData('products');

  let filtered = products.filter(p => String(p.status || '').trim() !== 'hidden');
  if (filterCategory && filterCategory !== 'all') {
    filtered = filtered.filter(p => String(p.category || '').trim() === filterCategory);
  }

  return filtered.map(p => {
    const images = [];

    if (p.drive_image_id) {
      images.push(getDriveImageUrl(String(p.drive_image_id).trim()));
    }
    if (p.drive_gallery_ids) {
      String(p.drive_gallery_ids).split(',')
        .map(id => id.trim()).filter(Boolean)
        .forEach(id => images.push(getDriveImageUrl(id)));
    }

    return {
      id:          String(p.product_id  || ''),
      name:        String(p.name        || 'Sản phẩm chưa có tên'),
      category:    String(p.category    || ''),
      description: String(p.description || ''),
      images
    };
  });
}

/**
 * Trả về URL thumbnail Google Drive ổn định.
 * sz=w600 đủ cho card grid mobile (tiết kiệm băng thông hơn w800).
 * Modal full-screen dùng sz=w1200.
 */
function getDriveImageUrl(fileId, size) {
  if (!fileId) return '';
  // lh3.googleusercontent.com/d/ hoạt động ổn định trên cả desktop lẫn mobile
  // (drive.google.com/thumbnail có thể bị CORS hoặc redirect login trên desktop browser)
  const sz = size || 'w800';
  return `https://lh3.googleusercontent.com/d/${fileId}=${sz}`;
}

// ==========================================
// 5. LƯU SẢN PHẨM TỪ ADMIN CMS
// ==========================================

/**
 * Nhận data từ Admin CMS, upload ảnh lên Drive, ghi sản phẩm vào sheet.
 * @param {Object} data
 * @param {string} data.name
 * @param {string} data.category
 * @param {string} data.description
 * @param {{base64:string, mimeType:string, name:string}} [data.mainImage]
 * @param {Array<{base64:string, mimeType:string, name:string}>} [data.galleryImages]
 * @returns {{ ok: boolean, productId?: string, error?: string }}
 */
function saveProductToSheet(data) {
  try {
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);

    // Upload ảnh chính
    let mainImageId = '';
    if (data.mainImage?.base64) {
      const blob = Utilities.newBlob(
        Utilities.base64Decode(data.mainImage.base64),
        data.mainImage.mimeType,
        data.mainImage.name
      );
      mainImageId = folder.createFile(blob).getId();
    }

    // Upload ảnh phụ
    const galleryIds = (data.galleryImages || []).map(img => {
      const blob = Utilities.newBlob(
        Utilities.base64Decode(img.base64), img.mimeType, img.name
      );
      return folder.createFile(blob).getId();
    });

    // Ghi vào Sheet
    const sheet     = getSheet('products');
    const productId = 'PRD-' + String(Date.now()).slice(-6);

    sheet.appendRow([
      productId,
      data.name        || '',
      data.category    || '',
      data.description || '',
      mainImageId,
      galleryIds.join(','),
      'active'
    ]);

    updateTimestamp();

    // Xóa cache liên quan để web cập nhật ngay
    const cache = CacheService.getScriptCache();
    cache.removeAll(['lookbook_getProducts_all', `lookbook_getProducts_${data.category}`, 'lookbook_getCategories_all']);

    return { ok: true, productId };
  } catch (err) {
    Logger.log('❌ saveProductToSheet error: ' + err.message);
    return { ok: false, error: err.message };
  }
}
