import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', async () => {
  const loginOverlay = document.getElementById('loginOverlay');
  const appContent = document.getElementById('appContent');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const logoutBtn = document.getElementById('logoutBtn');

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    showApp();
  } else {
    loginOverlay.classList.remove('hidden');
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      showApp();
    } else {
      appContent.style.display = 'none';
      loginOverlay.classList.remove('hidden');
    }
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      loginError.textContent = error.message;
      loginError.classList.remove('hidden');
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
  });

  function showApp() {
    loginOverlay.classList.add('hidden');
    appContent.style.display = 'block';
    loadCategories();
    if(document.querySelector('.tab-btn.active').dataset.target === 'tab-manage-products') {
      loadProductsList();
    } else if (document.querySelector('.tab-btn.active').dataset.target === 'tab-site-info') {
      loadSiteInfo();
    }
  }

  // --- TAB NAVIGATION ---
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active', 'text-black', 'border-black'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active', 'text-black', 'border-black');
      const target = document.getElementById(btn.dataset.target);
      target.classList.add('active');

      if (btn.dataset.target === 'tab-manage-products') {
        loadProductsList();
      } else if (btn.dataset.target === 'tab-site-info') {
        loadSiteInfo();
      }
    });
  });

  // Helpers
  async function touchSiteInfo() {
    const { data } = await supabase.from('site_info').select('id').limit(1).single();
    if (data && data.id) {
      await supabase.from('site_info').update({ updated_at: new Date().toISOString() }).eq('id', data.id);
    }
  }

  function setLoading(context, isLoading) {
    if (context === 'product') {
      const spinner = document.getElementById('loadingSpinner');
      const text = document.getElementById('btnText');
      if (isLoading) {
        spinner.classList.remove('hidden');
        text.textContent = 'Đang lưu...';
      } else {
        spinner.classList.add('hidden');
        text.textContent = 'Lưu Sản Phẩm';
      }
    } else if (context === 'siteInfo') {
      const spinner = document.getElementById('siteInfoSpinner');
      const text = document.getElementById('siteInfoBtnText');
      if (isLoading) {
        spinner.classList.remove('hidden');
        text.textContent = 'Đang lưu...';
      } else {
        spinner.classList.add('hidden');
        text.textContent = 'Lưu Cấu Hình';
      }
    }
  }

  function showStatus(context, msg, colorClass) {
    let el;
    if (context === 'product') el = document.getElementById('statusMessage');
    if (context === 'siteInfo') el = document.getElementById('siteInfoStatus');
    if(!el) return;

    el.textContent = msg;
    el.className = `ml-4 text-sm font-medium ${colorClass}`;
    setTimeout(() => { el.textContent = ''; }, 5000);
  }

  // --- TAB 1: ADD PRODUCT ---
  async function loadCategories() {
    const { data, error } = await supabase.from('categories').select('name').order('sort_order', { ascending: true });
    if (!error && data) {
      const select = document.getElementById('category');
      const currentValue = select.value;
      select.innerHTML = '<option value="" disabled selected>Chọn phân loại</option>';
      data.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        select.appendChild(option);
      });
      if (currentValue && data.some(c => c.name === currentValue)) {
        select.value = currentValue;
      }
    }
  }

  const addCategoryBtn = document.getElementById('addCategoryBtn');
  if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', async () => {
      const newCategory = prompt('Nhập tên phân loại mới (vui lòng kiểm tra chính tả kĩ nhé):');
      if (newCategory && newCategory.trim() !== '') {
        const catName = newCategory.trim();
        const { error } = await supabase.from('categories').upsert([{ name: catName }], { onConflict: 'name' });
        if (error) {
          alert('Lỗi khi thêm phân loại: ' + error.message);
        } else {
          await loadCategories();
          document.getElementById('category').value = catName;
          alert(`Đã thêm phân loại "${catName}"!`);
        }
      }
    });
  }

  const productForm = document.getElementById('productForm');
  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setLoading('product', true);
    
    try {
      const name = document.getElementById('name').value;
      const category = document.getElementById('category').value;
      const description = document.getElementById('description').value;
      const mainImageFile = document.getElementById('mainImage').files[0];
      const galleryFiles = document.getElementById('galleryImages').files;

      const productId = 'PRD-' + Math.floor(100000 + Math.random() * 900000);
      const imageUrls = [];

      const mainExt = mainImageFile.name.split('.').pop();
      const mainFileName = `${productId}_main_${Date.now()}.${mainExt}`;
      const { error: mainErr } = await supabase.storage.from('product-images').upload(mainFileName, mainImageFile);
      if (mainErr) throw mainErr;
      imageUrls.push(supabase.storage.from('product-images').getPublicUrl(mainFileName).data.publicUrl);

      for (let i = 0; i < galleryFiles.length; i++) {
        const file = galleryFiles[i];
        const ext = file.name.split('.').pop();
        const fileName = `${productId}_${i}_${Date.now()}.${ext}`;
        const { error: galErr } = await supabase.storage.from('product-images').upload(fileName, file);
        if (galErr) throw galErr;
        imageUrls.push(supabase.storage.from('product-images').getPublicUrl(fileName).data.publicUrl);
      }

      // Upsert category FIRST to ensure the foreign key exists in categories table
      await supabase.from('categories').upsert([{ name: category }], { onConflict: 'name' });

      const { data: lastRow } = await supabase.from('products').select('sort_order').order('sort_order', { ascending: false, nullsFirst: false }).limit(1);
      const nextOrder = ((lastRow && lastRow[0] && lastRow[0].sort_order) || 0) + 1;
      const { error: insertErr } = await supabase.from('products').insert([
        { id: productId, name, category, description, images: imageUrls, is_visible: true, sort_order: nextOrder }
      ]);
      if (insertErr) throw insertErr;
      
      // Trigger frontend reload by touching site_info
      await touchSiteInfo();

      showStatus('product', 'Đã lưu sản phẩm thành công!', 'text-green-600');
      productForm.reset();
      loadCategories();

    } catch (err) {
      console.error(err);
      showStatus('product', `Lỗi: ${err.message}`, 'text-red-600');
    } finally {
      setLoading('product', false);
    }
  });

  // --- TAB 2: MANAGE PRODUCTS ---
  const refreshProductsBtn = document.getElementById('refreshProductsBtn');
  refreshProductsBtn.addEventListener('click', loadProductsList);

  let productsCache = {};

  // --- DRAG TO REORDER (iOS-style) ---
  (function setupReorder() {
    const tbody = document.getElementById('productsTableBody');
    const reorderStatus = document.getElementById('reorderStatus');
    let drag = null;

    function flip(rows, beforeTops, skip) {
      rows.forEach(r => {
        if (r === skip) return;
        const dy = beforeTops.get(r) - r.getBoundingClientRect().top;
        if (!dy) return;
        r.style.transition = 'none';
        r.style.transform = `translateY(${dy}px)`;
        r.getBoundingClientRect();
        r.style.transition = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)';
        r.style.transform = '';
      });
    }

    tbody.addEventListener('pointerdown', (e) => {
      const handle = e.target.closest('.drag-handle');
      if (!handle) return;
      const row = handle.closest('tr');
      e.preventDefault();
      tbody.setPointerCapture(e.pointerId);
      drag = { row, handle, startY: e.clientY, pointerId: e.pointerId, lastY: e.clientY };
      row.classList.add('row-dragging');
      document.body.style.userSelect = 'none';
      row.style.transition = 'none';

      const tick = () => {
        if (!drag) return;
        if (drag.lastY < 70) window.scrollBy(0, -12);
        else if (drag.lastY > window.innerHeight - 70) window.scrollBy(0, 12);
        else { drag.raf = requestAnimationFrame(tick); return; }
        move(drag.lastY);
        drag.raf = requestAnimationFrame(tick);
      };
      drag.raf = requestAnimationFrame(tick);
    });

    function move(clientY) {
      const { row } = drag;
      drag.lastY = clientY;
      row.style.transform = `translateY(${clientY - drag.startY}px)`;
      const rows = [...tbody.querySelectorAll('tr[data-id]')];
      const rect = row.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const idx = rows.indexOf(row);
      let target = null, before = true;
      const prev = rows[idx - 1], next = rows[idx + 1];
      if (prev) { const r = prev.getBoundingClientRect(); if (center < r.top + r.height / 2) { target = prev; before = true; } }
      if (!target && next) { const r = next.getBoundingClientRect(); if (center > r.top + r.height / 2) { target = next; before = false; } }
      if (!target) return;
      const tops = new Map(rows.map(r => [r, r.getBoundingClientRect().top]));
      const oldTop = tops.get(row);
      if (before) tbody.insertBefore(row, target); else tbody.insertBefore(row, target.nextSibling);
      const newTop = row.getBoundingClientRect().top;
      drag.startY += (newTop - oldTop);
      row.style.transform = `translateY(${clientY - drag.startY}px)`;
      flip(rows, tops, row);
    }

    tbody.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.pointerId) return;
      move(e.clientY);
    });

    async function finish(e) {
      if (!drag || e.pointerId !== drag.pointerId) return;
      const { row, raf } = drag;
      cancelAnimationFrame(raf);
      drag = null;
      document.body.style.userSelect = '';
      row.style.transition = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 260ms';
      row.style.transform = '';
      setTimeout(() => { row.classList.remove('row-dragging'); row.style.transition = ''; }, 260);
      await saveOrder();
    }
    tbody.addEventListener('pointerup', finish);
    tbody.addEventListener('pointercancel', finish);

    async function saveOrder() {
      const rows = [...tbody.querySelectorAll('tr[data-id]')];
      const updates = [];
      rows.forEach((r, i) => {
        const p = productsCache[r.dataset.id];
        const order = i + 1;
        if (p && p.sort_order !== order) { p.sort_order = order; updates.push(supabase.from('products').update({ sort_order: order }).eq('id', r.dataset.id)); }
      });
      if (updates.length === 0) return;
      reorderStatus.textContent = 'Đang lưu thứ tự...';
      reorderStatus.className = 'text-xs text-gray-500';
      const results = await Promise.all(updates);
      const failed = results.find(r => r.error);
      if (failed) {
        reorderStatus.textContent = 'Lỗi lưu thứ tự: ' + failed.error.message;
        reorderStatus.className = 'text-xs text-red-600';
        return;
      }
      await touchSiteInfo();
      reorderStatus.textContent = 'Đã lưu thứ tự hiển thị';
      reorderStatus.className = 'text-xs text-green-600';
      setTimeout(() => { reorderStatus.textContent = ''; }, 2500);
    }
  })();

  async function loadProductsList() {    const tbody = document.getElementById('productsTableBody');
    const loading = document.getElementById('productsLoading');
    tbody.innerHTML = '';
    loading.classList.remove('hidden');

    const { data: products, error } = await supabase.from('products').select('*')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });
    loading.classList.add('hidden');

    if (error) {
      tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-4 text-center text-red-500">Lỗi khi tải dữ liệu.</td></tr>`;
      return;
    }

    if (products.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-4 text-center text-gray-500">Chưa có sản phẩm nào.</td></tr>`;
      return;
    }

    productsCache = {};
    products.forEach(p => {
      productsCache[p.id] = p;
      const tr = document.createElement('tr');
      const imgUrl = p.images && p.images.length > 0 ? p.images[0] : '';
      const imgHtml = imgUrl ? `<img src="${imgUrl}" class="w-10 h-10 object-cover rounded">` : `<div class="w-10 h-10 bg-gray-200 rounded"></div>`;
      
      const toggleClass = p.is_visible ? 'bg-green-500' : 'bg-gray-300';
      const toggleDotClass = p.is_visible ? 'translate-x-5' : 'translate-x-1';

      tr.dataset.id = p.id;
      tr.className = 'product-row bg-white';
      tr.innerHTML = `
        <td class="pl-3 pr-1 py-3 w-8">
          <button type="button" class="drag-handle" aria-label="Kéo để sắp xếp" title="Kéo để sắp xếp">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="3" r="1.4"/><circle cx="11" cy="3" r="1.4"/><circle cx="5" cy="8" r="1.4"/><circle cx="11" cy="8" r="1.4"/><circle cx="5" cy="13" r="1.4"/><circle cx="11" cy="13" r="1.4"/></svg>
          </button>
        </td>
        <td class="px-4 py-3 text-gray-600">${p.id}</td>
        <td class="px-4 py-3">${imgHtml}</td>
        <td class="px-4 py-3 font-medium">${escapeHtml(p.name)}</td>
        <td class="px-4 py-3">${escapeHtml(p.category)}</td>
        <td class="px-4 py-3 text-center">
          <button class="toggle-btn w-11 h-6 rounded-full relative transition-colors duration-200 focus:outline-none ${toggleClass}" data-id="${p.id}" data-state="${p.is_visible}">
            <div class="toggle-dot inline-block w-4 h-4 bg-white rounded-full absolute top-1 left-0 transition-transform duration-200 ${toggleDotClass}"></div>
          </button>
        </td>
        <td class="px-4 py-3 text-center">
          <button class="edit-btn px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm transition" data-id="${p.id}">Sửa</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    document.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget;
        const id = target.dataset.id;
        const currentState = target.dataset.state === 'true';
        const newState = !currentState;
        
        target.dataset.state = newState;
        target.classList.remove('bg-green-500', 'bg-gray-300');
        target.classList.add(newState ? 'bg-green-500' : 'bg-gray-300');
        const dot = target.querySelector('.toggle-dot');
        dot.classList.remove('translate-x-5', 'translate-x-1');
        dot.classList.add(newState ? 'translate-x-5' : 'translate-x-1');

        const { error } = await supabase.from('products').update({ is_visible: newState }).eq('id', id);
        if (error) {
          alert('Lỗi khi cập nhật trạng thái: ' + error.message);
          target.dataset.state = currentState;
          target.classList.remove('bg-green-500', 'bg-gray-300');
          target.classList.add(currentState ? 'bg-green-500' : 'bg-gray-300');
          dot.classList.remove('translate-x-5', 'translate-x-1');
          dot.classList.add(currentState ? 'translate-x-5' : 'translate-x-1');
        } else {
          // Trigger frontend reload by touching site_info
          await touchSiteInfo();
        }
      });
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => openEditModal(btn.dataset.id));
    });
  }

  // --- EDIT PRODUCT ---
  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const editModal = document.getElementById('editModal');
  const editForm = document.getElementById('editForm');
  const editStatus = document.getElementById('editStatus');
  let editingId = null;
  let editImages = [];

  function renderEditImages() {
    const box = document.getElementById('editImages');
    box.innerHTML = '';
    editImages.forEach((url, i) => {
      const div = document.createElement('div');
      div.className = 'relative group';
      div.innerHTML = `
        <img src="${escapeHtml(url)}" class="w-full aspect-square object-cover rounded-lg border ${i === 0 ? 'ring-2 ring-black' : ''}">
        ${i === 0 ? '<span class="absolute bottom-1 left-1 bg-black text-white text-[10px] px-1.5 py-0.5 rounded">Chính</span>' : '<button type="button" data-act="main" class="absolute bottom-1 left-1 bg-white/90 text-[10px] px-1.5 py-0.5 rounded border">Đặt làm chính</button>'}
        <button type="button" data-act="remove" class="absolute top-1 right-1 w-6 h-6 bg-red-600 text-white rounded-full text-sm leading-none">&times;</button>
      `;
      div.querySelector('[data-act="remove"]').addEventListener('click', () => {
        editImages.splice(i, 1);
        renderEditImages();
      });
      const mainBtn = div.querySelector('[data-act="main"]');
      if (mainBtn) mainBtn.addEventListener('click', () => {
        const [u] = editImages.splice(i, 1);
        editImages.unshift(u);
        renderEditImages();
      });
      box.appendChild(div);
    });
  }

  function setEditCategories(selected) {
    const src = document.getElementById('category');
    const sel = document.getElementById('editCategory');
    sel.innerHTML = '';
    Array.from(src.options).filter(o => o.value).forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.textContent;
      sel.appendChild(opt);
    });
    if (selected && !Array.from(sel.options).some(o => o.value === selected)) {
      const opt = document.createElement('option');
      opt.value = selected;
      opt.textContent = selected;
      sel.appendChild(opt);
    }
    sel.value = selected;
  }

  async function openEditModal(id) {
    const p = productsCache[id];
    if (!p) return;
    editingId = id;
    editStatus.textContent = '';
    document.getElementById('editProductId').textContent = id;
    document.getElementById('editName').value = p.name || '';
    document.getElementById('editDescription').value = p.description || '';
    document.getElementById('editNewImages').value = '';
    setEditCategories(p.category);
    editImages = Array.isArray(p.images) ? [...p.images] : [];
    renderEditImages();
    editModal.classList.remove('hidden');
    editModal.classList.add('flex');
  }

  function closeEditModal() {
    editModal.classList.add('hidden');
    editModal.classList.remove('flex');
    editingId = null;
  }

  document.getElementById('editCloseBtn').addEventListener('click', closeEditModal);
  document.getElementById('editCancelBtn').addEventListener('click', closeEditModal);

  document.getElementById('editAddCategoryBtn').addEventListener('click', async () => {
    const newCategory = prompt('Nhập tên phân loại mới (vui lòng kiểm tra chính tả kĩ nhé):');
    if (newCategory && newCategory.trim() !== '') {
      const catName = newCategory.trim();
      const { error } = await supabase.from('categories').upsert([{ name: catName }], { onConflict: 'name' });
      if (error) {
        alert('Lỗi khi thêm phân loại: ' + error.message);
      } else {
        await loadCategories();
        setEditCategories(catName);
      }
    }
  });

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editingId) return;
    const saveBtn = document.getElementById('editSaveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Đang lưu...';
    editStatus.textContent = '';

    try {
      const name = document.getElementById('editName').value.trim();
      const category = document.getElementById('editCategory').value;
      const description = document.getElementById('editDescription').value;
      const newFiles = document.getElementById('editNewImages').files;
      const images = [...editImages];

      for (let i = 0; i < newFiles.length; i++) {
        const file = newFiles[i];
        const ext = file.name.split('.').pop();
        const fileName = `${editingId}_e${i}_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('product-images').upload(fileName, file);
        if (upErr) throw upErr;
        images.push(supabase.storage.from('product-images').getPublicUrl(fileName).data.publicUrl);
      }

      if (images.length === 0) throw new Error('Sản phẩm cần ít nhất 1 hình ảnh.');

      await supabase.from('categories').upsert([{ name: category }], { onConflict: 'name' });
      const { error } = await supabase.from('products')
        .update({ name, category, description, images }).eq('id', editingId);
      if (error) throw error;

      await touchSiteInfo();
      closeEditModal();
      loadProductsList();
    } catch (err) {
      console.error(err);
      editStatus.textContent = `Lỗi: ${err.message}`;
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Lưu thay đổi';
    }
  });

  // --- TAB 3: SITE INFO ---
  let siteInfoId = null;
  async function loadSiteInfo() {
    const { data, error } = await supabase.from('site_info').select('*').limit(1).single();
    if (data && !error) {
      siteInfoId = data.id || null;
      document.getElementById('siteTitle').value = data.site_title || '';
      document.getElementById('collectionTitle').value = data.collection_title || '';
      document.getElementById('collectionDesc').value = data.collection_desc || '';
    }
  }

  const siteInfoForm = document.getElementById('siteInfoForm');
  siteInfoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setLoading('siteInfo', true);

    const site_title = document.getElementById('siteTitle').value;
    const collection_title = document.getElementById('collectionTitle').value;
    const collection_desc = document.getElementById('collectionDesc').value;
    const updated_at = new Date().toISOString();

    try {
      if (siteInfoId) {
        const { error } = await supabase.from('site_info').update({
          site_title, collection_title, collection_desc, updated_at
        }).eq('id', siteInfoId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('site_info').insert([{
          site_title, collection_title, collection_desc, updated_at
        }]).select();
        if (error) throw error;
        if(data && data.length > 0) siteInfoId = data[0].id;
      }
      showStatus('siteInfo', 'Đã cập nhật cấu hình website!', 'text-green-600');
    } catch (err) {
      console.error(err);
      showStatus('siteInfo', `Lỗi: ${err.message}`, 'text-red-600');
    } finally {
      setLoading('siteInfo', false);
    }
  });

});
