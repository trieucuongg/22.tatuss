import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ccvtwjxkekipkaxmwobh.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_jyApZ7a7V02t5x6hx2CRfg_w_v3TqgH';
const supabase = createClient(supabaseUrl, supabaseKey);

export function clearCache() {
  // Not needed since Supabase Client is fast, but we keep this to satisfy main.js
}

export async function checkForUpdates() {
  // Simple check using updated_at from site_info table
  const { data } = await supabase.from('site_info').select('updated_at').limit(1).single();
  if (!data) return false;
  
  if (!window.localTimestamp) {
    window.localTimestamp = data.updated_at;
    return false;
  }
  
  if (window.localTimestamp !== data.updated_at) {
    window.localTimestamp = data.updated_at;
    return true;
  }
  
  return false;
}

export async function getCategories() {
  const { data, error } = await supabase.from('categories').select('name').order('sort_order', { ascending: true });
  if (error) {
    console.error('Lỗi khi fetch categories:', error);
    return [];
  }
  return data.map(c => c.name);
}

export async function getProducts(category = 'all') {
  let query = supabase.from('products').select('*');
  if (category !== 'all') {
    query = query.eq('category', category);
  }
  const { data, error } = await query;
  if (error) {
    console.error('Lỗi khi fetch products:', error);
    return [];
  }
  return data;
}

export async function getSiteInfo() {
  const { data, error } = await supabase.from('site_info').select('*').limit(1).single();
  if (error) {
    console.error('Lỗi khi fetch site info:', error);
    return null;
  }
  return data;
}

export async function fetchAllInitialData() {
  const [siteInfo, categories, products] = await Promise.all([
    getSiteInfo(),
    getCategories(),
    getProducts('all')
  ]);
  return { siteInfo, categories, products };
}
