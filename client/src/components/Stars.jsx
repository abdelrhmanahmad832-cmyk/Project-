import { Star } from '@phosphor-icons/react';

export default function Stars({ value = 0, count, onChange, size = 16 }) {
  const rounded = Math.round(value);
  return (
    <span className="stars" aria-label={onChange ? undefined : `التقييم ${value || 0} من 5`} role={onChange ? 'radiogroup' : 'img'}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button type="button" key={n} className={n <= rounded ? 'on' : ''} onClick={() => onChange(n)} role="radio" aria-checked={n === rounded} aria-label={`${n} من 5`}>
            <Star size={size} weight="fill" />
          </button>
        ) : (
          <Star key={n} size={size} weight="fill" className={n <= rounded ? 'on' : ''} />
        )
      )}
      {count !== undefined && <span className="rating-text">{value} ({count})</span>}
    </span>
  );
}
