export default function Stars({ value = 0, count, onChange, size = '1rem' }) {
  const rounded = Math.round(value);
  return (
    <span className="stars" style={{ fontSize: size }} aria-label={`التقييم ${value || 0} من 5`}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button type="button" key={n} className={n <= rounded ? 'on' : ''} onClick={() => onChange(n)} aria-label={`${n} نجوم`}>★</button>
        ) : (
          <span key={n} className={n <= rounded ? 'on' : ''}>★</span>
        )
      )}
      {count !== undefined && <small className="muted"> ({count})</small>}
    </span>
  );
}
