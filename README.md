# 🛍️ سوق — متجر إلكتروني Full Stack

متجر إلكتروني كامل باللغة العربية (RTL) مبني بـ **React** و **Express** و **PostgreSQL**، مع دفع إلكتروني عبر **Stripe**.

كل البيانات — بما فيها الصور المرفوعة — محفوظة في قاعدة بيانات PostgreSQL أونلاين (Supabase أو Neon مجاناً)، فالخادم لا يحفظ أي شيء على القرص ويمكن نشره على أي استضافة مجانية.

## المميزات

**للعملاء**
- تصفح المنتجات مع البحث، التصفية حسب التصنيف، الترتيب (السعر / الأحدث / التقييم)، وتقسيم الصفحات
- صفحة لكل منتج مع **تقييمات ومراجعات** (فقط لمن اشترى المنتج)
- سلة مشتريات تتحدث أسعارها ومخزونها تلقائياً
- **أكواد خصم** و**رسوم شحن** مع شحن مجاني فوق حد معيّن
- **الدفع الإلكتروني بالبطاقة (Stripe)** أو الدفع عند الاستلام
- صفحة لكل طلب تعرض مراحل التوصيل، مع إمكانية **إلغاء الطلب** أو إعادة محاولة الدفع
- صفحة "حسابي": تعديل البيانات، حفظ العنوان، تغيير كلمة المرور
- تصميم احترافي متجاوب: شريط تنقل سفلي على الموبايل مثل التطبيقات، ووضع داكن تلقائي (راجع [DESIGN.md](DESIGN.md))

**للمدير (لوحة التحكم)**
- إحصائيات: الإيرادات، الطلبات المعلقة، المنتجات منخفضة المخزون، العملاء
- إضافة وتعديل وحذف المنتجات مع **رفع الصور من الجهاز** (أو رابط خارجي)
- إدارة الطلبات وتصفيتها حسب الحالة — إلغاء طلب مدفوع **يسترد المبلغ تلقائياً** عبر Stripe
- إدارة أكواد الخصم (نسبة أو مبلغ ثابت، حد أدنى، عدد استخدامات، تاريخ انتهاء)
- إدارة المستخدمين وترقيتهم لمديرين

**الأمان**
- كلمات مرور مشفرة (bcrypt) ومصادقة JWT بمفتاح عشوائي يُولَّد تلقائياً
- تحديد عدد محاولات تسجيل الدخول، وترويسات أمان (Helmet + CSP)
- التحقق من محتوى الصور المرفوعة فعلياً (وليس الامتداد فقط)
- الأسعار والخصومات والمخزون تُحسب دائماً على الخادم، والطلبات تتم داخل معاملات (transactions) مع قفل الصفوف، فلا يمكن بيع نفس القطعة مرتين حتى لو طلبها عميلان في نفس اللحظة

## التقنيات

| الجزء | التقنية |
|------|---------|
| الواجهة | React 19 + React Router + Vite، أيقونات Phosphor، خطوط Amiri و IBM Plex Sans Arabic (مستضافة محلياً) |
| الخادم | Node.js + Express 5 |
| قاعدة البيانات | PostgreSQL (Supabase / Neon / أي مزود) |
| الدفع | Stripe Checkout |
| رفع الملفات | Multer |

## التشغيل

يتطلب **Node.js 20.12 أو أحدث**.

### 1. أنشئ قاعدة بيانات مجانية

**Supabase** (أو Neon — نفس الفكرة):
1. سجّل في [supabase.com](https://supabase.com) واضغط **New project** واختر كلمة مرور لقاعدة البيانات.
2. من **Project Settings → Database → Connection string** انسخ رابط **URI**، واستبدل `[YOUR-PASSWORD]` بكلمة المرور.

**Neon:** سجّل في [neon.tech](https://neon.tech)، أنشئ مشروعاً، وانسخ **Connection string** من لوحة التحكم.

### 2. شغّل المتجر

```bash
npm install
cp .env.example .env      # ثم ضع رابط قاعدة البيانات في DATABASE_URL
npm run dev               # الخادم (4000) والواجهة (5173) معاً
```

افتح http://localhost:5173 — الجداول تُنشأ تلقائياً عند أول تشغيل.

**حساب المدير الافتراضي:** `admin@store.com` / `admin123` — يُنشأ تلقائياً مع 8 منتجات تجريبية. **غيّر كلمة المرور فوراً** من صفحة "حسابي".

### الإعدادات

انسخ `.env.example` إلى `.env` وعدّل ما تحتاجه (اسم المتجر، العملة، رسوم الشحن، مفاتيح Stripe...). كل القيم اختيارية.

### تفعيل الدفع الإلكتروني (Stripe)

بدون مفاتيح Stripe يعمل المتجر بالدفع عند الاستلام فقط. لتفعيل الدفع بالبطاقة:

1. أنشئ حساباً على [stripe.com](https://stripe.com) وانسخ **Secret key** من Developers → API keys (ابدأ بمفتاح `sk_test_...` للتجربة).
2. ضعه في `.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   ```
3. **(موصى به في الإنتاج)** أضف Webhook من Developers → Webhooks يشير إلى
   `https://موقعك/api/payments/webhook` مع الأحداث:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`،
   ثم ضع مفتاح التوقيع في `STRIPE_WEBHOOK_SECRET=whsec_...`.
   للتجربة محلياً: `stripe listen --forward-to localhost:4000/api/payments/webhook`.

بطاقة تجريبية: `4242 4242 4242 4242` بأي تاريخ مستقبلي وأي CVC.

> حتى بدون Webhook، يتم تأكيد الدفع عند رجوع العميل من صفحة الدفع، ويقوم الخادم كل 5 دقائق بمزامنة الطلبات المعلقة وإلغاء الطلبات التي انتهت صلاحية جلسة دفعها (30 دقيقة) وإرجاع مخزونها.

> **ملاحظة:** Stripe غير متاح لأصحاب المتاجر في بعض الدول العربية. منطق الدفع معزول في `server/src/services/payments.js` لتسهيل استبداله ببوابة محلية (مثل Paymob أو Tap أو HyperPay).

### النشر على الإنترنت (Render — مجاناً)

1. ارفع المشروع على GitHub (موجود بالفعل).
2. في [render.com](https://render.com): **New → Blueprint** واختر المستودع — سيقرأ ملف `render.yaml` تلقائياً.
3. الصق رابط قاعدة البيانات في `DATABASE_URL` واضغط **Apply**.
4. بعد دقائق تحصل على رابط مثل `https://souq.onrender.com`. ضعه في `PUBLIC_URL` إذا فعّلت Stripe.

لا تحتاج أي قرص تخزين (Disk) لأن كل البيانات في قاعدة البيانات.

### الإنتاج على خادمك

```bash
npm run build
npm start        # الخادم يقدّم الواجهة والـ API على المنفذ 4000
```

أو باستخدام Docker:

```bash
docker build -t souq .
docker run -p 4000:4000 --env-file .env souq
```

### الاختبارات

الاختبارات تمسح قاعدة البيانات وتعيد إنشاءها، لذلك استخدم **قاعدة بيانات منفصلة فارغة** للاختبار:

```bash
TEST_DATABASE_URL=postgresql://... npm test
```

تغطي تسجيل الدخول، المنتجات، رفع الصور، الخصومات، الشحن، الطلبات، الإلغاء، الدفع عبر Stripe (بعميل وهمي)، الـ Webhook، التقييمات، الصلاحيات، وطلبين متزامنين على آخر قطعة.

## هيكل المشروع

```
├── client/                 # واجهة React
│   └── src/
│       ├── pages/          # الرئيسية، المنتج، السلة، الدفع، الطلبات، حسابي، لوحة التحكم
│       ├── components/     # Navbar, ProductCard, Stars, Pagination
│       ├── context/        # Auth, Cart, Config, Toast
│       └── api.js
└── server/                 # خادم Express
    ├── src/
    │   ├── routes/         # auth, products (+reviews), orders, coupons, users, uploads, payments
    │   ├── services/       # منطق الطلبات، الخصومات، الدفع، الصور
    │   ├── config.js       # الإعدادات من متغيرات البيئة
    │   ├── db.js           # الاتصال بـ PostgreSQL والجداول
    │   └── seed.js
    └── test/
```

## الـ API

| الطريقة | المسار | الصلاحية |
|---------|--------|----------|
| GET | `/api/config` | عام |
| POST | `/api/auth/register` · `/api/auth/login` | عام |
| GET / PUT | `/api/auth/me` · PUT `/api/auth/me/password` | مستخدم |
| GET | `/api/products` (`q` `category` `sort` `page` `limit` `inStock` `ids`) · `/api/products/:id` · `/api/products/categories` | عام |
| POST / PUT / DELETE | `/api/products[/:id]` | مدير |
| GET / POST | `/api/products/:id/reviews` · DELETE `/api/products/:id/reviews/:reviewId` | عام / مشترٍ |
| POST | `/api/orders/quote` · `/api/orders` | مستخدم |
| GET | `/api/orders/mine` · `/api/orders/:id` | مستخدم |
| POST | `/api/orders/:id/cancel` · `/pay` · `/verify-payment` | مستخدم |
| GET | `/api/orders` (`status`) · `/api/orders/stats` · PATCH `/api/orders/:id/status` | مدير |
| GET / POST / PATCH / DELETE | `/api/coupons[/:id]` | مدير |
| GET | `/api/users` · PATCH `/api/users/:id/role` | مدير |
| POST | `/api/uploads` (multipart، الحقل `image`) | مدير |
| POST | `/api/payments/webhook` | Stripe |
