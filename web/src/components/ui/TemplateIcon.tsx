import type { Category } from '@/types/accessory';
import { CategoryIcon } from './CategoryIcon';

/**
 * テンプレ一覧用の線画アイコン。
 * 見た目が特徴的なテンプレ（コイン/ハート/宝石…）は専用SVG、
 * それ以外はカテゴリの線画(CategoryIcon)を流用して統一感を保つ。
 * stroke=currentColor で親の文字色を継承。
 */
export function TemplateIcon({
  id,
  category,
  className = '',
}: {
  id: string;
  category: Category;
  className?: string;
}) {
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

  switch (id) {
    case 'tpl-disc-pendant': // コインペンダント
      return (
        <svg {...common}>
          <circle cx="12" cy="13" r="7" />
          <circle cx="12" cy="13" r="4" />
          <circle cx="12" cy="4" r="1.4" />
        </svg>
      );
    case 'tpl-heart-ruby': // ハート×ルビー
      return (
        <svg {...common}>
          <path d="M12 20 C5 14.5 5.5 8 9 8 C11 8 12 9.6 12 9.6 C12 9.6 13 8 15 8 C18.5 8 19 14.5 12 20 Z" />
        </svg>
      );
    case 'tpl-initial-tag': // イニシャル刻印
      return (
        <svg {...common}>
          <rect x="5" y="4.5" width="14" height="15" rx="2.5" />
          <path d="M9.5 15 L12 9 L14.5 15" />
          <path d="M10.4 13 H13.6" />
        </svg>
      );
    case 'tpl-hook-diamond': // 一粒フックピアス（宝石）
      return (
        <svg {...common}>
          <path d="M7 9 H17 L12 20 Z" />
          <path d="M7 9 L9.5 13 H14.5 L17 9" />
          <path d="M9.5 13 L12 20 L14.5 13" />
        </svg>
      );
    case 'tpl-pearl-stud': // パールスタッド（真珠）
      return (
        <svg {...common}>
          <circle cx="12" cy="13" r="6.5" />
          <circle cx="9.6" cy="10.4" r="1.4" />
        </svg>
      );
    case 'tpl-drop-earring': // ドロップピアス（雫）
      return (
        <svg {...common}>
          <circle cx="12" cy="4" r="1.2" />
          <path d="M12 7 C8.5 11 7 13.5 7 16 A5 5 0 0 0 17 16 C17 13.5 15.5 11 12 7 Z" />
        </svg>
      );
    case 'tpl-three-stone': // 三石リング
      return (
        <svg {...common}>
          <circle cx="12" cy="15" r="6" />
          <path d="M12 5 L13.4 7 L12 9 L10.6 7 Z" />
          <path d="M7.6 6.2 L8.6 7.6 L7.6 9 L6.6 7.6 Z" />
          <path d="M16.4 6.2 L17.4 7.6 L16.4 9 L15.4 7.6 Z" />
        </svg>
      );
    default:
      return <CategoryIcon category={category} className={className} />;
  }
}
