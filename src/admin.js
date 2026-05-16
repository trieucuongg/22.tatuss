import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// DOM Elements
const loginOverlay = document.getElementById('loginOverlay');
const appContent = document.getElementById('appContent');
const loginForm = document.getElementById('loginForm');
const logoutBtn = document.getElementById('logoutBtn');
const productForm = document.getElementById('productForm');
const categoriesList = document.getElementById('categoriesList');

// UI State
const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('btnText');
const spinner = document.getElementById('loadingSpinner');
const statusMsg = document.getElementById('statusMessage');

// ==========================================
// Authentication
// ==========================================
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    loginOverlay.classList.add('hidden');
    appContent.style.display = 'block';
    loadCategories();
  } else {
    loginOverlay.classList.remove('hidden');
    appContent.style.display = 'none';
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('authEmail').value;
  const password = document.getElementById('authPassword').value;
  const errorEl = document.getElementById('loginError');
  
  errorEl.classList.add('hidden');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  
  if (error) {
    errorEl.textContent = error.message;
    errorEl.classList.remove('hidden');
  } else {
    checkAuth();
  }
});

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  checkAuth();
});

// ==========================================
// Load Data
// ==========================================
async function loadCategories() {
  const { data, error } = await supabase.from('categories').select('name').order('sort_order');
  if (data) {
    categoriesList.innerHTML = data.map(c => `<option value="${c.name}">`).join('');
  }
}

// ==========================================
// Upload Logic
// ==========================================
function generateId() {
  return 'PRD-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
}

async function uploadFile(file) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error } = await supabase.storage.from('product-images').upload(filePath, file);
  if (error) throw error;
  
  const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
  return data.publicUrl;
}

productForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  submitBtn.disabled = true;
  submitBtn.classList.add('opacity-70', 'cursor-not-allowed');
  btnText.textContent = 'Đang tải lên...';
  spinner.classList.remove('hidden');
  statusMsg.textContent = 'Đang upload hình ảnh...';
  statusMsg.className = 'mr-4 text-sm font-medium text-blue-600';

  try {
    const name = document.getElementById('name').value;
    const category = document.getElementById('category').value;
    const description = document.getElementById('description').value;

    const mainFile = document.getElementById('mainImage').files[0];
    const galleryFiles = document.getElementById('galleryImages').files;

    // 1. Upload Main Image
    const mainUrl = await uploadFile(mainFile);

    // 2. Upload Gallery Images
    const imageUrls = [mainUrl];
    for (let i = 0; i < galleryFiles.length; i++) {
      const url = await uploadFile(galleryFiles[i]);
      imageUrls.push(url);
    }

    // 3. Ensure Category exists
    await supabase.from('categories').insert([{ name: category }]).select('*').single()
      .then()
      .catch(() => {}); // ignore conflict

    // 4. Insert Product
    const newProduct = {
      id: generateId(),
      name,
      category,
      description,
      images: imageUrls
    };

    const { error: dbError } = await supabase.from('products').insert([newProduct]);
    if (dbError) throw dbError;

    // Success
    statusMsg.textContent = 'Đã thêm sản phẩm thành công!';
    statusMsg.className = 'mr-4 text-sm font-medium text-green-600';
    productForm.reset();
    
  } catch (error) {
    console.error(error);
    statusMsg.textContent = 'Lỗi: ' + error.message;
    statusMsg.className = 'mr-4 text-sm font-medium text-red-600';
  } finally {
    submitBtn.disabled = false;
    submitBtn.classList.remove('opacity-70', 'cursor-not-allowed');
    btnText.textContent = 'Lưu Sản Phẩm';
    spinner.classList.add('hidden');
    setTimeout(() => { if(statusMsg.classList.contains('text-green-600')) statusMsg.textContent = ''; }, 5000);
  }
});

// Initialize
checkAuth();
