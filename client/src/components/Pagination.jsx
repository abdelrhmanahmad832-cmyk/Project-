import { CaretLeft, CaretRight } from '@phosphor-icons/react';

export default function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  const nums = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) nums.push(i);
  return (
    <nav className="pagination" aria-label="الصفحات">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="الصفحة السابقة"><CaretRight size={18} /></button>
      {nums.map((n) => (
        <button key={n} aria-current={n === page ? 'page' : undefined} onClick={() => onChange(n)}>{n}</button>
      ))}
      <button disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="الصفحة التالية"><CaretLeft size={18} /></button>
    </nav>
  );
}
