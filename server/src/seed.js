import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { pool, one, initDb } from './db.js';

const products = [
  ['سماعات لاسلكية', 'سماعات بلوتوث بعزل ضوضاء وبطارية تدوم 30 ساعة.', 1450, 25, 'إلكترونيات', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600'],
  ['ساعة ذكية', 'تتبع اللياقة ونبض القلب مع شاشة AMOLED.', 2300, 15, 'إلكترونيات', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'],
  ['كاميرا فورية', 'كاميرا تطبع الصور فوراً بألوان زاهية.', 3100, 8, 'إلكترونيات', 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600'],
  ['حذاء رياضي', 'حذاء خفيف ومريح للجري والاستخدام اليومي.', 1200, 40, 'أزياء', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600'],
  ['حقيبة ظهر', 'حقيبة مقاومة للماء مع جيب للابتوب 15 بوصة.', 850, 30, 'أزياء', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600'],
  ['نظارة شمسية', 'حماية كاملة من الأشعة فوق البنفسجية بتصميم كلاسيكي.', 650, 50, 'أزياء', 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600'],
  ['كوب قهوة سيراميك', 'كوب يدوي الصنع بسعة 350 مل.', 180, 100, 'المنزل', 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600'],
  ['نبتة منزلية', 'نبتة داخلية سهلة العناية مع أصيص أنيق.', 320, 20, 'المنزل', 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=600'],
];

export async function seedIfEmpty() {
  const { n: userCount } = await one('SELECT COUNT(*) AS n FROM users');
  if (!userCount) {
    const email = process.env.ADMIN_EMAIL || 'admin@store.com';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    await pool.query("INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')", [
      'المدير',
      email.toLowerCase(),
      bcrypt.hashSync(password, 10),
    ]);
    console.log(`تم إنشاء حساب المدير: ${email} / ${password}`);
    if (!process.env.ADMIN_PASSWORD) console.log('⚠️  غيّر كلمة مرور المدير من صفحة "حسابي" بعد تسجيل الدخول');
  }
  const { n: productCount } = await one('SELECT COUNT(*) AS n FROM products');
  if (!productCount) {
    for (const p of products) {
      await pool.query(
        'INSERT INTO products (name, description, price, stock, category, image_url) VALUES ($1, $2, $3, $4, $5, $6)',
        p
      );
    }
    console.log(`تمت إضافة ${products.length} منتجات تجريبية`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await initDb();
  await seedIfEmpty();
  await pool.end();
}
