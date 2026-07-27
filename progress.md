# progress.md — [todo] 작업 기록

> 규칙: 최신 세션이 맨 위. 세션당 5줄 이내. 지우지 말고 쌓기(append-only)

---

## 2026-07-27
- **Done**: Lint cleanup + subDrag effect dep-array fix; template endTime save/restore (B-2, +test);
  unified sub-item ordering to manual `order` across all 3 views (B-1); extracted shared view logic
  into `useTimelineInteractions` hook (Stage B, ~380 dup lines removed). 70 tests green, browser-verified.
- **Decided**: B-1 → manual order; B-2 → persist endTime. Keep MixView/TimelineView JSX separate; share
  logic via hook, not by merging components.
- **Blocked**: Stray `.claire/worktrees/…` dir pollutes `npm run lint` (not source, not in CI) — asked owner, pending.
- **Next**: Confirm `.claire` cleanup; then start feature work (gamification / recurring routines per prd.md).

---

## 작성 예시
- **완료**: 투두 추가/삭제 기능 구현, 화면에서 동작 확인
- **결정**: 데이터 저장은 localStorage 대신 JSON 파일 방식으로
- **막힌 것**: 날짜 정렬이 간헐적으로 어긋남 (원인 미확인)
- **다음 할 일**: 날짜 정렬 버그 원인 찾기 → 완료 체크 기능 추가
