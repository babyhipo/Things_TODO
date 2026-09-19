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

/** 별 버튼 꺼짐(일반 일정) 색 — 입력칸 별 버튼과 같은 회색 테두리 */
export const STAR_OFF_COLOR = '#C0C4D4';

interface StarToggleButtonProps {
  starred: boolean;
  onToggle: () => void;
}

/**
 * 이미 등록한 일정의 별 켜기/끄기 버튼 — 일정을 눌러 글자를 고치는 동안에만 카드 오른쪽에 나타난다.
 * 누를 때 수정칸 포커스가 빠지면 수정이 저장·종료되므로, 누르는 순간의 포커스 이동을 막는다.
 */
export function StarToggleButton({ starred, onToggle }: StarToggleButtonProps) {
  return (
    <button
      type="button"
      aria-label="주요 일정 표시"
      aria-pressed={starred}
      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onToggle}
      style={{
        flex: '0 0 auto',
        width: 24,
        height: 24,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <StarIcon size={18} color={starred ? STAR_COLOR : STAR_OFF_COLOR} filled={starred} />
    </button>
  );
}
