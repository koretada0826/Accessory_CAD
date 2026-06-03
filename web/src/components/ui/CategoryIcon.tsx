import type { Category } from '@/types/accessory';

/**
 * カテゴリの線画アイコン（絵文字を廃し、上質なミニマル・ライン表現に）。
 * stroke=currentColor で親の文字色を継承。
 */
export function CategoryIcon({ category, className = '' }: { category: Category; className?: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    width: 24,
    height: 24,
  };

  switch (category) {
    case 'pendant':
    case 'charm':
      return (
        <svg {...common}>
          <circle cx="12" cy="4.5" r="1.8" />
          <path d="M12 6.3 L7.5 12 L12 20 L16.5 12 Z" />
        </svg>
      );
    case 'ring':
    case 'band':
      return (
        <svg {...common}>
          <circle cx="12" cy="14" r="6.5" />
          <path d="M9.3 7.8 L12 4 L14.7 7.8" />
        </svg>
      );
    case 'stone_ring':
    case 'signet':
      return category === 'signet' ? (
        <svg {...common}>
          <path d="M7 5 H17 V11 A5 6 0 0 1 7 11 Z" />
          <path d="M10.5 9 H13.5" />
        </svg>
      ) : (
        <svg {...common}>
          <circle cx="12" cy="15" r="6" />
          <path d="M9 6.5 L12 3 L15 6.5 L12 9 Z" />
        </svg>
      );
    case 'earrings':
      return (
        <svg {...common}>
          <path d="M12 9 C12 5 16 5 14.5 3.5" />
          <circle cx="12" cy="14" r="3.6" />
        </svg>
      );
    case 'hoop':
      return (
        <svg {...common}>
          <circle cx="12" cy="13" r="7" />
          <circle cx="12" cy="6" r="1.2" />
        </svg>
      );
    case 'earcuff':
      return (
        <svg {...common}>
          <path d="M16 6 A7 7 0 1 0 16 18" />
          <circle cx="16" cy="6" r="1" />
          <circle cx="16" cy="18" r="1" />
        </svg>
      );
    case 'bracelet':
      return (
        <svg {...common}>
          <path d="M4 12 A8 6 0 0 1 20 12" />
          <ellipse cx="8" cy="13.5" rx="2" ry="1.3" />
          <ellipse cx="12" cy="14.5" rx="2" ry="1.3" />
          <ellipse cx="16" cy="13.5" rx="2" ry="1.3" />
        </svg>
      );
    case 'necklace':
      return (
        <svg {...common}>
          <path d="M4 5 Q12 16 20 5" />
          <circle cx="12" cy="17" r="2.4" />
        </svg>
      );
    case 'dogtag':
      return (
        <svg {...common}>
          <rect x="7.5" y="4" width="9" height="16" rx="2.5" />
          <circle cx="12" cy="7" r="1" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" />
        </svg>
      );
  }
}
