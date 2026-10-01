export default function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  const nums = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) nums.push(i);
  return (
    <nav className="pagination" aria-label="الصفحات">
      <button className="chip-btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>السابق</button>
      {nums.map((n) => (
        <button key={n} className={`chip-btn ${n === page ? 'active' : ''}`} onClick={() => onChange(n)}>{n}</button>
      ))}
      <button className="chip-btn" disabled={page >= pages} onClick={() => onChange(page + 1)}>التالي</button>
    </nav>
  );
}
