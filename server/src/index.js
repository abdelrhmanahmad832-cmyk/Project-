import { app } from './app.js';
import { seedIfEmpty } from './seed.js';

seedIfEmpty();

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`الخادم يعمل على http://localhost:${PORT}`));
