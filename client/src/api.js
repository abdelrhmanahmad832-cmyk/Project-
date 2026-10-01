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

export const PLACEHOLDER_IMG =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450"><rect width="600" height="450" fill="#e5e7eb"/><text x="300" y="250" font-size="90" text-anchor="middle">🛍️</text></svg>'
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
