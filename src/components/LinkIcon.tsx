// 공유용 링크(사슬) 아이콘 — 도구줄 공유 버튼, 공유받은 화면 표시에 사용
export function LinkIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 15l6 -6M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
