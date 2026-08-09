# progress.md — [todo] 작업 기록

> 규칙: 최신 세션이 맨 위. 세션당 5줄 이내. 지우지 말고 쌓기(append-only)

---

## 2026-08-09
- **Done**: Drag UX overhaul — position/card-relative time (reverted acceleration), grab keeps original
  time (selfAnchor + grabOffset, no jump), now-line as interpolation waypoint, same-time "snap zone"
  (±8px) to pick order (above=first/below=second) with translucent drag card. Same-time todos fully
  supported (add/typed/drag → registration order; `assignTimeAt` store action). Sub-item & unscheduled
  cards got click-edit + swipe-delete; unscheduled drop onto a card → becomes its sub-item.
  '내일로 미루기' (right-swipe, incomplete only). Fonts ~1.1x + card text unified; time column narrowed
  & timeline shifted left across all 3 views. **83 tests green, lint/build clean, browser-verified.**
- **Decided**: Drag = card-relative (not accelerated) — "drop position = actual time"; keep same-time
  ordering via snap zone, tunable `DRAG_SNAP_ZONE` in `src/lib/timelineMath.ts`.
- **Blocked**: 없음. (`.claire` stray worktree was removed earlier.)
- **Next**: Owner to feel-test drag on real iPhone (tune DRAG_SNAP_ZONE/thresholds if needed). Not pushed
  (21 commits ahead of origin) — owner tests locally then pushes. Then: feature work per prd.md
  (gamification "좍-" tear-off/ranking, recurring routines/templates).

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
