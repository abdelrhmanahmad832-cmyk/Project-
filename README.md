# 🛍️ سوق — متجر إلكتروني Full Stack

متجر إلكتروني كامل باللغة العربية (RTL) مبني بـ **React** و **Express** و **SQLite**.

## المميزات

**للعملاء**
- تصفح المنتجات مع البحث والتصفية حسب التصنيف
- صفحة تفاصيل لكل منتج
- سلة مشتريات محفوظة في المتصفح
- إنشاء حساب وتسجيل دخول (JWT)
- إتمام الطلب (الدفع عند الاستلام) ومتابعة حالة الطلبات

**للمدير (لوحة التحكم)**
- إحصائيات: الإيرادات، عدد الطلبات، المنتجات، العملاء
- إضافة وتعديل وحذف المنتجات
- عرض كل الطلبات وتغيير حالتها (عند الإلغاء يرجع المخزون تلقائياً)

## التقنيات

| الجزء | التقنية |
|------|---------|
| الواجهة | React 19 + React Router + Vite |
| الخادم | Node.js + Express 5 |
| قاعدة البيانات | SQLite (`node:sqlite` المدمجة — بدون إعداد خارجي) |
| المصادقة | JWT + bcrypt |

## التشغيل

يتطلب **Node.js 22.13 أو أحدث**.

```bash
npm install      # تثبيت كل الحزم (الخادم والواجهة)
npm run dev      # تشغيل الخادم (4000) والواجهة (5173) معاً
```

افتح http://localhost:5173

### حساب المدير الافتراضي
- البريد: `admin@store.com`
- كلمة المرور: `admin123`

يتم إنشاؤه تلقائياً مع 8 منتجات تجريبية عند أول تشغيل. غيّره عبر متغيرات البيئة `ADMIN_EMAIL` و `ADMIN_PASSWORD` قبل أول تشغيل.

### الإنتاج

```bash
npm run build                    # بناء الواجهة
JWT_SECRET=<سر-قوي> npm start    # الخادم يقدّم الواجهة والـ API على المنفذ 4000
```

### متغيرات البيئة (اختيارية)

| المتغير | الافتراضي | الوصف |
|---------|-----------|-------|
| `PORT` | `4000` | منفذ الخادم |
| `JWT_SECRET` | قيمة تطوير | **يجب تغييره في الإنتاج** |
| `DB_PATH` | `server/store.db` | مسار ملف قاعدة البيانات |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@store.com` / `admin123` | حساب المدير الأول |

## هيكل المشروع

```
├── client/               # واجهة React
│   └── src/
│       ├── pages/        # الصفحات (الرئيسية، المنتج، السلة، الدفع، الطلبات، لوحة التحكم...)
│       ├── components/   # Navbar, ProductCard
│       ├── context/      # AuthContext, CartContext
│       └── api.js        # دوال الاتصال بالـ API
└── server/               # خادم Express
    └── src/
        ├── routes/       # auth, products, orders
        ├── db.js         # قاعدة البيانات والجداول
        ├── auth.js       # JWT middleware
        └── seed.js       # بيانات تجريبية
```

## الـ API

| الطريقة | المسار | الصلاحية |
|---------|--------|----------|
| POST | `/api/auth/register` · `/api/auth/login` | عام |
| GET | `/api/auth/me` | مستخدم |
| GET | `/api/products` (`?q=` `&category=`) · `/api/products/:id` · `/api/products/categories` | عام |
| POST / PUT / DELETE | `/api/products[/:id]` | مدير |
| POST | `/api/orders` | مستخدم |
| GET | `/api/orders/mine` | مستخدم |
| GET | `/api/orders` · `/api/orders/stats` | مدير |
| PATCH | `/api/orders/:id/status` | مدير |
