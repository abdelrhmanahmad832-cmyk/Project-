const TOKEN_KEY = 'souq_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'حدث خطأ غير متوقع');
  return data;
}

export function uploadImage(file) {
  const form = new FormData();
  form.append('image', file);
  return api('/uploads', { method: 'POST', form });
}

let currency = 'EGP';
export const setCurrency = (c) => (currency = c);
export const formatPrice = (n) =>
  new Intl.NumberFormat('ar-EG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);

export const formatDate = (s) => new Date(s).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });

// Neutral "no image" tile (a drawn bag outline) — works offline and in both themes.
export const PLACEHOLDER_IMG =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><rect width="400" height="500" fill="#e6e6e3"/>' +
      '<g fill="none" stroke="#b3b1ac" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M140 210h120l-10 110a14 14 0 0 1-14 13h-72a14 14 0 0 1-14-13z"/><path d="M168 210v-14a32 32 0 0 1 64 0v14"/></g></svg>'
  );

export const STATUS_LABELS = {
  pending: 'قيد الانتظار',
  processing: 'قيد التجهيز',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
};

export const PAYMENT_STATUS_LABELS = { unpaid: 'غير مدفوع', paid: 'مدفوع', refunded: 'مسترد' };
export const PAYMENT_METHOD_LABELS = { cod: 'الدفع عند الاستلام', card: 'بطاقة إلكترونية' };
