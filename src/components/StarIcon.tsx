// 주요 일정(별) 아이콘 — 입력창 별 버튼과 카드 체크박스(동그라미 대신)에서 함께 쓴다.

/** 미완료 주요 일정의 노란색 */
export const STAR_COLOR = '#F5B800';
/** 완료한 주요 일정 — 다른 완료 카드와 같은 회색 */
export const STAR_DONE_COLOR = '#9CA3AF';

interface StarIconProps {
  size: number;
  color: string;
  /** true = 색으로 채운 별, false = 테두리만 (입력창 별 버튼이 꺼졌을 때) */
  filled?: boolean;
}

export function StarIcon({ size, color, filled = true }: StarIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <path
        d="M12 2.8l2.76 5.6 6.18.9-4.47 4.36 1.05 6.15L12 16.9l-5.52 2.91 1.05-6.15L3.06 9.3l6.18-.9z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={filled ? 1 : 1.8}
        strokeLinejoin="round"
      />
    </svg>
  );
}
