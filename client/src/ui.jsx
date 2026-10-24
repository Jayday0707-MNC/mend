export const CATEGORIES = ['water', 'power', 'pothole', 'other'];
export const STATUSES = ['reported', 'confirmed', 'in_progress', 'resolved'];
export const CONFIRM_AT = 3; // people affected before a report counts as confirmed

export const CATEGORY_LABEL = { water: 'Water', power: 'Power', pothole: 'Pothole', other: 'Other' };
export const STATUS_LABEL = {
  reported: 'Reported',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  resolved: 'Resolved',
};

// The reporter counts as one voice, so affected = confirmations + 1
export const affected = (r) => (r.confirmations ?? 0) + 1;

export function CategoryIcon({ category, size = 20 }) {
  const paths = {
    water: <path d="M12 3c3.2 3.9 5.5 6.9 5.5 9.6a5.5 5.5 0 0 1-11 0C6.5 9.9 8.8 6.9 12 3z" />,
    power: <path d="M13 2 5 13h6l-1 9 8-11h-6l1-9z" />,
    pothole: (
      <>
        <path d="M12 4 3 20h18L12 4z" />
        <path d="M12 10v4" />
        <path d="M12 17h.01" />
      </>
    ),
    other: (
      <>
        <path d="M6 12h.01" />
        <path d="M12 12h.01" />
        <path d="M18 12h.01" />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={category === 'other' ? 3.4 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[category] || paths.other}
    </svg>
  );
}

export function CategoryBadge({ category, large }) {
  return (
    <span className={`cbadge c-${category} ${large ? 'lg' : ''}`}>
      <CategoryIcon category={category} size={large ? 24 : 20} />
    </span>
  );
}

export function CategoryTag({ category }) {
  return (
    <span className={`cat c-${category}`}>
      <i />
      {CATEGORY_LABEL[category] || category}
    </span>
  );
}

export function StatusPill({ status }) {
  return (
    <span className={`spill st-${status}`}>
      <i />
      {STATUS_LABEL[status] || status}
    </span>
  );
}

// The four steps a report moves through, filled up to the current one
export function StatusSteps({ status }) {
  const current = STATUSES.indexOf(status);
  return (
    <ol className="steps" aria-label={`Status: ${STATUS_LABEL[status]}`}>
      {STATUSES.map((s, i) => (
        <li key={s} className={i < current ? 'done' : i === current ? 'now' : ''}>
          <span className="node" />
          {STATUS_LABEL[s]}
        </li>
      ))}
    </ol>
  );
}

export function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} d ago`;
  return new Date(iso).toLocaleDateString();
}