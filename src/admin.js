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

      const { error: insertErr } = await supabase.from('products').insert([
        { id: productId, name, category, description, images: imageUrls, is_visible: true }
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

  async function loadProductsList() {
    const tbody = document.getElementById('productsTableBody');
    const loading = document.getElementById('productsLoading');
    tbody.innerHTML = '';
    loading.classList.remove('hidden');

    const { data: products, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    loading.classList.add('hidden');

    if (error) {
      tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-4 text-center text-red-500">Lỗi khi tải dữ liệu.</td></tr>`;
      return;
    }

    if (products.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-4 text-center text-gray-500">Chưa có sản phẩm nào.</td></tr>`;
      return;
    }

    products.forEach(p => {
      const tr = document.createElement('tr');
      const imgUrl = p.images && p.images.length > 0 ? p.images[0] : '';
      const imgHtml = imgUrl ? `<img src="${imgUrl}" class="w-10 h-10 object-cover rounded">` : `<div class="w-10 h-10 bg-gray-200 rounded"></div>`;
      
      const toggleClass = p.is_visible ? 'bg-green-500' : 'bg-gray-300';
      const toggleDotClass = p.is_visible ? 'translate-x-5' : 'translate-x-1';

      tr.innerHTML = `
        <td class="px-4 py-3 text-gray-600">${p.id}</td>
        <td class="px-4 py-3">${imgHtml}</td>
        <td class="px-4 py-3 font-medium">${p.name}</td>
        <td class="px-4 py-3">${p.category}</td>
        <td class="px-4 py-3 text-center">
          <button class="toggle-btn w-11 h-6 rounded-full relative transition-colors duration-200 focus:outline-none ${toggleClass}" data-id="${p.id}" data-state="${p.is_visible}">
            <div class="toggle-dot inline-block w-4 h-4 bg-white rounded-full absolute top-1 left-0 transition-transform duration-200 ${toggleDotClass}"></div>
          </button>
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
  }

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
