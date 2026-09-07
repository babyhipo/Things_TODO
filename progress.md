# progress.md — [todo] 작업 기록

> 규칙: 최신 세션이 맨 위. 세션당 5줄 이내. 지우지 말고 쌓기(append-only)

---

## 2026-08-20 (시간표뷰 삭제 — 목록·믹스만)
- **Done**: 시간표(timetable) 뷰 완전 제거. App.tsx에서 TimelineView 렌더·import 삭제,
  ViewToggle에서 'timetable' 세그먼트·아이콘 제거(ContentView='list'|'mix'), TemplatePanel
  안내문구 '시간표'→'믹스'. 데드 파일 4개 삭제(오너 승인): TimelineView.tsx/.module.css +
  기존 미사용 TimetableView.tsx/.module.css. 훅 useTimelineInteractions·timelineMath는 믹스뷰가
  써서 유지. 번들 감소(JS 291→277KB, CSS 53→41KB). 83 tests green, build clean, 콘솔 에러 0.
- **Next**: 실기기 확인, 미푸시(오너가 푸시).

## 2026-08-20 (믹스뷰 저녁 구분선: 제거했다가 오후 6시 기준으로 복원)
- **Update**: 믹스뷰 '저녁' 구분선 다시 표시(앞서 넣었던 return null 제거). 기준은
  기존 SECTION_MARKS 그대로 **오후 6시(18:00)**. e2e: 오전일→[오후]→오후일→저녁직전(17:50)
  →[저녁]→여섯시(18:00). 83 tests green, build clean.
- **Done(이전)**: 믹스뷰 섹션 구분선을 '오후'만 남기고 '저녁'(section-eve) 렌더 생략했었음
  → 위 Update로 되돌림. 시간표뷰는 계속 오후+저녁 유지.
- **확인(코드변경 없음)**: "시간미지정 카드 탭 편집"은 이미 정상 동작. 믹스·시간표·목록 3뷰
  모두 예정카드와 동일한 `beginEdit` onClick 핸들러 존재, 실제 입력으로 열림·타이핑·저장 검증 완료
  (`.unscheduledText`는 flex:1로 탭 영역도 넓음). 오너 환경에서 안 될 경우 로컬 dev 서버 재시작
  (HMR 캐시 꼬임 가능) + 하드 리프레시 권장.
- **Blocked**: 없음. **Next**: 실기기 확인, 미푸시(오너가 푸시).

## 2026-08-15 (드래그 시간 표시 디자인 복원)
- **Done**: 재배치 동작은 그대로 두고 시각 요소만 추가. 믹스·시간표뷰 — 드래그 중 카드에
  **알약(시간)+짧은 선** 인디케이터 복원, 들어간 자리를 **점선 테두리(outline)** 로 강조.
  일정카드·미지정카드·하위일정 3종 통일(하위는 시간 없어 알약 생략, 점선만). 목록뷰 —
  드래그로 순서 바꿀 때 배정될 시간을 **드래그 카드 텍스트로 미리보기**(알약 아님, 파란색).
  미리보기와 실제 드롭 결과가 항상 일치하도록 스토어 시간보간을 `computeReorderedTime`
  순수함수로 분리해 `reorderTodos`와 목록뷰가 공용. **83 tests green, build clean, 3뷰 브라우저 검증.**
- **Decided**: 인디케이터 선은 가로 실선이 아니라 예전 알약+짧은선 유지. "점선박스"는 별도
  빈 박스가 아니라 들어간 카드의 점선 테두리로 표현. 드래그 재배치 로직은 변경 없음.
- **Refine(오너 스샷 반영)**: 시간 알약을 손가락 위치의 고정 오버레이가 아니라 **드래그 카드
  줄 왼쪽에 앵커링**(카드와 함께 이동, `.dragPill`), 카드 안 원래 시간 텍스트는 알약으로
  대체(중복 제거). 믹스=카드 내부, 시간표=eventRow 좌측. 두 뷰 브라우저 재검증(믹스 14:45,
  시간표 17:40 정상). 83 tests green, build clean.
- **Refine2(입체감)**: 카드 위에 덮이던 안쪽 점선(outline -2) 제거 → 카드는 불투명+진한
  그림자로 "튀어오른" 느낌. 카드보다 사방 5px 큰 **점선 박스(`.dropBox`)를 카드 뒤(z-index:-1)**에
  별도 배치(카드 바깥으로 삐져나옴). eventRow가 스태킹 컨텍스트라 dropBox는 카드 뒤·배경 앞에
  머묾. 프로세스: 요구분석→구현→독립 병렬 코드리뷰(서브에이전트)→e2e DOM 검사. e2e로 사방
  +5px·z-index:-1·카드 opacity:1·카드가 최상단 확인. 리뷰 지적 반영: 죽은 `ghostRef`(유령카드
  제거 후 항상 null → iOS 펄스 유실)를 실제 대상요소(`cardEl`/`subEl` 조회)로 교체, 미사용
  `.timeLabelDragging` 삭제. 83 tests green, build clean, 서버 재시작 후 재검증(하위드래그 정상).
- **Blocked**: 없음.
- **Next**: 아이폰 실기기 체감 테스트. 미푸시(로컬 확인 후 오너가 푸시).

---

## 2026-08-09 (2세션: 드래그 시각언어 통일)
- **Done**: 드래그 UX를 "실제 카드 재배치" 방식으로 통일. 별도 시간 알약(floatingIndicator)·점선
  미리보기칸(dropZone)·유령복제카드(ghostCard) 전부 제거. 훅에 `displayScheduled` 추가 —
  드래그 중 잡은 카드(또는 타임라인 위로 끈 미지정 카드)를 목표 슬롯에 실제 삽입한 순서로
  `segments`를 만들어, 이웃 카드가 유기적으로 밀려나고 카드 안 시간 텍스트가 목표 시간으로 갱신됨.
  일정카드·미지정카드·하위일정 3종 모두 반투명(lifted) 통일. 미지정→카드 편입, 하위→부모변경 유지
  (대상 카드 강조). 죽은 CSS 정리. **83 tests green, build clean, 두 뷰(믹스/시간표) 브라우저 검증.**
- **Decided**: 드래그 카드는 슬롯 단위로 "재배치"(손가락 붕뜨기 X). 미지정 카드는 타임라인 위에선
  실제 이벤트카드로 삽입되고 미지정 목록에선 잠시 숨김. 컴포넌트는 계속 분리, 로직은 훅에서 공유.
- **Blocked**: 없음.
- **Next**: 아이폰 실기기에서 드래그 감(재배치 순간 이웃 이동이 즉각적 — 필요시 FLIP 부드럽게)
  체감 테스트. 미푸시(로컬 테스트 후 오너가 푸시). 이후 prd.md 기능(게이미피케이션/루틴 템플릿).

---

## 2026-08-09 (1세션)
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

---

## 2026-09-07
- **Done**: (1) 상단 기능바에 **'미루기'** 버튼 추가 — 미완료 최상위 카드 + 그 하위일정을
  같은 시간대(time·endTime) 그대로 내일로 일괄 이동, 완료 상태는 초기화(오른쪽 스와이프와 동일 규칙).
  완료 카드는 오늘에 남음. 오늘 탭에서만 활성, 미완료가 없으면 비활성. 되돌리기(undo) 지원.
  스토어 액션 `moveIncompleteToTomorrow(day)` 신설 + 테스트 5개.
  (2) **오른쪽 스와이프 시 화면이 통째로 밀리던 버그 수정** — 원인: 카드에 `touch-action`이 없어
  브라우저가 가로 제스처를 스크롤로 가로챔. 본문 `<main>`이 `overflow-y:auto`라 CSS 규칙상
  가로축도 `auto`가 되어(카드가 오른쪽 80px 밀리는 순간 스크롤 영역 발생) 화면이 슬라이드됨.
  왼쪽은 스크롤 영역이 안 생겨 삭제만 정상 동작했던 것. 수정: `.card`/`.subItem`/`.unscheduledItem`에
  `touch-action: pan-y`, `AppShell .main`에 `overflow-x: hidden`.
  **88 tests green, lint/build clean, 브라우저에서 미루기·카드/하위/미지정 우스와이프·좌스와이프 삭제 검증.**
- **Decided**: 일괄 미루기 범위는 '미완료 최상위 카드'. 완료된 부모 아래 미완료 하위일정은
  부모 맥락을 유지하려고 오늘에 남김(개별 스와이프로 옮길 수 있음).
- **Blocked**: 없음.
- **Next**: 아이폰 실기기에서 우스와이프 체감 확인. 미푸시(오너가 로컬 확인 후 푸시).
