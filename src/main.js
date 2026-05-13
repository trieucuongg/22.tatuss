import { getCategories, getProducts, clearCache, checkForUpdates, getSiteInfo } from './api.js';

let currentCategory = 'all';
let allProducts = []; // Cache tất cả sản phẩm cho search

// DOM Elements
const categoryNav    = document.getElementById('category-nav');
const productGrid    = document.getElementById('product-grid');
const mainContent    = document.getElementById('main-content');
const searchOverlay  = document.getElementById('search-overlay');
const searchBackdrop = document.getElementById('search-backdrop');
const searchInput    = document.getElementById('search-input');
const searchResults  = document.getElementById('search-results');

// ========================================
// SEARCH LOGIC
// ========================================

function openSearch() {
  searchOverlay.classList.add('active');
  searchBackdrop.classList.add('active');
  searchOverlay.removeAttribute('aria-hidden');
  document.body.style.overflow = 'hidden';
  setTimeout(() => searchInput.focus(), 60);
  renderSearchResults(''); // Hiện gợi ý ban đầu
}

function closeSearch() {
  searchOverlay.classList.remove('active');
  searchBackdrop.classList.remove('active');
  searchOverlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  searchInput.value = '';
  searchResults.innerHTML = '';
}

function highlight(text, query) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
}

function renderSearchResults(query) {
  const q = query.trim().toLowerCase();
  const matched = q
    ? allProducts.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q))
      )
    : allProducts.slice(0, 6); // Top 6 gợi ý mặc định

  if (matched.length === 0) {
    searchResults.innerHTML = `<p class="search-empty">Không tìm thấy sản phẩm nào 🙁</p>`;
    return;
  }

  searchResults.innerHTML = matched.map((p, i) => {
    const thumb = p.images && p.images[0] ? p.images[0] : '';
    const imgEl = thumb
      ? `<img class="search-result-thumb" src="${thumb}" alt="${p.name}" loading="lazy">`
      : `<div class="search-result-thumb img-skeleton"></div>`;
    return `
      <div class="search-result-item" data-idx="${i}">
        ${imgEl}
        <div class="search-result-info">
          <div class="search-result-name">${highlight(p.name, q)}</div>
          <div class="search-result-meta">${p.category || ''}</div>
        </div>
        <span class="material-symbols-outlined search-result-arrow">arrow_forward_ios</span>
      </div>
    `;
  }).join('');

  // Gắn event listener thực sự — tránh lỗi JSON double-quote trong onclick attribute
  searchResults.querySelectorAll('.search-result-item').forEach(el => {
    el.addEventListener('click', () => {
      const product = matched[Number(el.dataset.idx)];
      if (!product) return;
      closeSearch();
      // Đợi overlay đóng xong (300ms) rồi mới mở modal
      setTimeout(() => {
        openZoomModal(product.name, encodeURIComponent(JSON.stringify(product.images)));
      }, 310);
    });
  });
}

// Debounce để tránh search liên tục khi gõ
let searchDebounceTimer = null;
searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    renderSearchResults(searchInput.value);
  }, 180);
});

document.getElementById('search-toggle-btn').addEventListener('click', openSearch);
document.getElementById('search-close-btn').addEventListener('click', closeSearch);
searchBackdrop.addEventListener('click', closeSearch);

// Đóng search khi nhấn Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && searchOverlay.classList.contains('active')) closeSearch();
});

// ========================================
// DRAG-TO-SCROLL — Hỗ trợ kéo chuột trên desktop
// ========================================

function makeDraggable(el) {
  // Tránh gắn lại nếu đã setup rồi
  if (el._draggable) return;
  el._draggable = true;

  let isDown = false;
  let startX, startScrollLeft;

  el.addEventListener('mousedown', e => {
    isDown = true;
    startX = e.pageX - el.offsetLeft;
    startScrollLeft = el.scrollLeft;
    el.style.cursor = 'grabbing';
    e.preventDefault(); // ngăn chặn text selection khi drag
  });
  el.addEventListener('mouseleave', () => {
    isDown = false;
    el.style.cursor = 'grab';
  });
  el.addEventListener('mouseup', () => {
    isDown = false;
    el.style.cursor = 'grab';
  });
  el.addEventListener('mousemove', e => {
    if (!isDown) return;
    const x    = e.pageX - el.offsetLeft;
    const walk = (x - startX) * 1.2;
    el.scrollLeft = startScrollLeft - walk;
  });

  el.style.cursor = 'grab';
}

// ========================================
// MODAL LOGIC
// ========================================

window.closeZoomModal = function() {
  const modal = document.getElementById('zoom-modal');
  modal.style.opacity = '0';
  modal.style.pointerEvents = 'none';
  setTimeout(() => {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }, 300);
};

window.openZoomModal = function(productName, imagesStr) {
  const images = JSON.parse(decodeURIComponent(imagesStr));
  const modal   = document.getElementById('zoom-modal');
  const gallery = document.getElementById('zoom-gallery');
  const indicatorsContainer = document.getElementById('zoom-indicators');
  const title   = document.getElementById('zoom-title');

  title.textContent = productName;
  gallery.innerHTML = '';
  indicatorsContainer.innerHTML = '';

  images.forEach((src, index) => {
    // Wrap ảnh trong div có class zoom-img-wrap (CSS overlay sẽ áp lên)
    const imgContainer = document.createElement('div');
    imgContainer.className = 'zoom-img-wrap w-full h-full flex-shrink-0 snap-center flex items-center justify-center bg-surface-container-lowest relative';
    const img = document.createElement('img');
    img.src = src;
    img.className = 'max-w-full max-h-full object-contain select-none';
    img.draggable = false;
    imgContainer.appendChild(img);
    gallery.appendChild(imgContainer);

    const indicator = document.createElement('div');
    indicator.className = `w-2 h-2 rounded-full transition-all duration-300 ${index === 0 ? 'bg-primary w-4' : 'bg-outline-variant'}`;
    indicatorsContainer.appendChild(indicator);
  });

  gallery.addEventListener('scroll', () => {
    const activeIndex = Math.round(gallery.scrollLeft / gallery.clientWidth);
    const indicators  = indicatorsContainer.children;
    for (let i = 0; i < indicators.length; i++) {
      indicators[i].className = i === activeIndex
        ? 'w-4 h-2 rounded-full transition-all duration-300 bg-primary'
        : 'w-2 h-2 rounded-full transition-all duration-300 bg-outline-variant';
    }
  }, { passive: true });

  // Hiện modal với display: flex để flex-1 hoạt động đúng
  modal.style.display = 'flex';
  modal.style.pointerEvents = '';
  requestAnimationFrame(() => { modal.style.opacity = '1'; });
  document.body.style.overflow = 'hidden';

  // Kéo chuột cho desktop (sau khi gallery đã có nội dung)
  makeDraggable(gallery);
};

// ========================================
// RENDER LOGIC
// ========================================

async function renderSiteInfo() {
  const info = await getSiteInfo();
  if (!info) return;
  if (info.site_title) {
    document.title = info.site_title;
    const el = document.getElementById('site-title');
    if (el) el.textContent = info.site_title;
  }
  if (info.collection_title) {
    const el = document.getElementById('collection-title');
    if (el) el.textContent = info.collection_title;
  }
  if (info.collection_desc) {
    const el = document.getElementById('collection-desc');
    if (el) el.textContent = info.collection_desc;
  }
}

async function renderCategories() {
  const categories = await getCategories();
  if (!categories) return;

  categoryNav.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = 'snap-center text-label-caps font-label-caps whitespace-nowrap hover:opacity-70 transition-all duration-300 ease-in-out border-b-2 pb-1 text-primary border-primary';
  allBtn.textContent = 'All';
  allBtn.onclick = () => switchTab(allBtn, 'all');
  categoryNav.appendChild(allBtn);

  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'snap-center text-label-caps font-label-caps whitespace-nowrap hover:opacity-70 transition-all duration-300 ease-in-out border-b-2 pb-1 text-secondary border-transparent';
    btn.textContent = cat;
    btn.onclick = () => switchTab(btn, cat);
    categoryNav.appendChild(btn);
  });
}

async function renderProducts() {
  const products = await getProducts(currentCategory);
  if (!products) return;

  // Lưu vào allProducts để search dùng (chỉ fetch all một lần)
  if (currentCategory === 'all') {
    allProducts = products;
  } else if (allProducts.length === 0) {
    // Nếu user vào thẳng một category, preload all sản phẩm cho search
    getProducts('all').then(all => { if (all) allProducts = all; });
  }

  productGrid.innerHTML = '';

  products.forEach((product, index) => {
    const card = document.createElement('div');
    card.className = 'product-card flex flex-col group cursor-pointer';
    card.style.animationDelay = `${index * 45}ms`;

    const images = (product.images && product.images.length > 0) ? product.images : [];

    // Build swipe strip
    const stripItems = images.length > 0
      ? images.map((src, i) => `
          <div class="card-swipe-slide">
            <div class="img-skeleton absolute inset-0" id="skel-${product.id}-${i}"></div>
            <img
              loading="lazy"
              decoding="async"
              alt="${product.name}"
              class="product-img w-full h-full object-cover"
              src="${src}"
              onload="this.classList.add('loaded'); document.getElementById('skel-${product.id}-${i}')?.remove();"
              onerror="this.classList.add('loaded'); document.getElementById('skel-${product.id}-${i}')?.remove();"
            >
          </div>
        `).join('')
      : `<div class="card-swipe-slide"><div class="img-skeleton absolute inset-0"></div></div>`;

    // Indicators (only show when >1 image)
    const indicators = images.length > 1
      ? `<div class="card-indicators">${images.map((_, i) =>
          `<span class="card-dot${i === 0 ? ' active' : ''}"></span>`
        ).join('')}</div>`
      : '';

    card.innerHTML = `
      <div class="aspect-square w-full bg-surface-container overflow-hidden mb-4 relative card-swipe-wrap" data-product-id="${product.id}">
        <div class="card-swipe-strip">
          ${stripItems}
        </div>
        ${indicators}
      </div>
      <h3 class="text-body-md font-body-md text-primary">${product.name}</h3>
    `;

    // Swipe indicator sync
    const strip = card.querySelector('.card-swipe-strip');
    const dots  = card.querySelectorAll('.card-dot');
    if (strip && dots.length > 1) {
      strip.addEventListener('scroll', () => {
        const idx = Math.round(strip.scrollLeft / strip.clientWidth);
        dots.forEach((d, i) => d.classList.toggle('active', i === idx));
      }, { passive: true });
    }

    // Mouse drag scroll cho desktop
    if (strip) makeDraggable(strip);

    // Swipe vs Tap detection — chỉ mở modal khi user thực sự tap (không vuốt)
    let pointerStartX = 0;
    let isSwiping = false;

    if (strip) {
      strip.addEventListener('pointerdown', e => {
        pointerStartX = e.clientX;
        isSwiping = false;
      }, { passive: true });
      strip.addEventListener('pointermove', e => {
        if (Math.abs(e.clientX - pointerStartX) > 8) isSwiping = true;
      }, { passive: true });
    }

    // Tap on card opens zoom modal (only if not swiping)
    card.addEventListener('click', () => {
      if (!isSwiping) {
        openZoomModal(product.name, encodeURIComponent(JSON.stringify(images)));
      }
    });

    productGrid.appendChild(card);
  });


  // Trigger smooth tab fade animation
  mainContent.classList.remove('tab-content');
  void mainContent.offsetWidth;
  mainContent.classList.add('tab-content');
}

function switchTab(clickedBtn, category) {
  categoryNav.querySelectorAll('button').forEach(btn => {
    btn.className = 'snap-center text-label-caps font-label-caps whitespace-nowrap hover:opacity-70 transition-all duration-300 ease-in-out border-b-2 pb-1 text-secondary border-transparent';
  });
  clickedBtn.className = 'snap-center text-label-caps font-label-caps whitespace-nowrap hover:opacity-70 transition-all duration-300 ease-in-out border-b-2 pb-1 text-primary border-primary';
  clickedBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

  currentCategory = category;
  renderProducts();
}

// ========================================
// INITIALIZATION
// ========================================

async function init() {
  await renderSiteInfo();
  await renderCategories();
  await renderProducts();

  // Auto-update mỗi 20 giây
  setInterval(async () => {
    const hasUpdate = await checkForUpdates();
    if (hasUpdate) {
      console.log('✨ Data mới từ Google Sheet! Tự động cập nhật...');
      allProducts = [];
      await renderSiteInfo();
      await renderCategories();
      await renderProducts();
    }
  }, 20000);
}

init();

// ========================================
// IMAGE PROTECTION
// ========================================

// Chặn chuột phải (right-click) trên toàn trang
document.addEventListener('contextmenu', e => {
  if (e.target.tagName === 'IMG' || e.target.closest('.product-card, #zoom-modal')) {
    e.preventDefault();
  }
});

// Chặn drag-and-drop ảnh
document.addEventListener('dragstart', e => {
  if (e.target.tagName === 'IMG') e.preventDefault();
});

// MutationObserver: tự động set draggable=false cho mọi ảnh được thêm vào DOM
const imgObserver = new MutationObserver(mutations => {
  mutations.forEach(m => {
    m.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      const imgs = node.tagName === 'IMG' ? [node] : [...node.querySelectorAll('img')];
      imgs.forEach(img => { img.draggable = false; });
    });
  });
});
imgObserver.observe(document.body, { childList: true, subtree: true });
