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

## 2026-09-07 (2세션: 시간 해제 · 자정 구분선 · 미지정 순서변경)
- **Done**:
  (1) **일정카드를 타임라인 아래 '시간 미지정' 구역으로 내리면 시간 지정 해제.** 예전에는 맨 아래로
  내리면 하루 끝(가상 1679 = 새벽 3:59)으로 등록됐음. `isDragOverUnscheduled(ds)`(= currentY >
  containerBottom) 추가 → 드롭 시 `unscheduleTodo`(time·endTime 지움, order 맨 뒤). 드래그 중에는
  카드가 타임라인에서 빠지고 미지정 목록에 미리 나타나며 제목이 '여기에 놓으면 시간 해제'로 바뀜(점선 강조).
  (2) **'자정' 구분선 추가 + 드래그 감도 완화.** SECTION_MARKS에 자정(가상 1440) 추가. 구분선
  (오후/저녁/자정)을 드래그 시간 앵커(`sectionAnchors`)로 사용 → 카드가 없는 구간에서 시간이 튀지 않고
  구분선 사이로 보간됨(저녁~자정 중간 = 약 22시로 검증). `.timeline` 아래 16px 여백을 주어 자정~새벽
  구간의 조작 여유 + 해제 구역과의 완충 확보(대신 `.unscheduled` margin-top 24→8, 화면 간격은 동일).
  (3) **시간 미지정 항목끼리 순서 변경.** 미지정 손잡이를 타임라인 아래에서 끌면 목록 안에서 순서 변경
  (드래그 중 실시간 미리보기, 드롭 시 `reorderUnscheduled` — 시간 지정 카드의 order는 건드리지 않음).
  (4) 미지정 카드의 **하위일정도 미지정 구역에 표시**(시간 해제 시 하위일정이 화면에서 사라지던 문제).
  **96 tests green, lint/build clean, 브라우저에서 4가지 모두 검증.**
- **Decided**: 구분선을 시간 앵커로 쓰는 방식으로 감도 조절(별도 감속 계수 도입 X) — 화면에 보이는
  기준선과 실제 시간이 일치해 직관적.
- **Blocked**: 없음.
- **Next**: 아이폰 실기기 체감(해제 구역 경계·자정 구간 감도). 미푸시(오너가 로컬 확인 후 푸시).

## 2026-09-07 (3세션: 하위↔상위 드래그드롭 전환)
- **Done**: 드래그드롭으로 상위/하위를 양방향 전환.
  · **하위 → 상위 승격**: 하위일정 손잡이를 부모 묶음 밖 타임라인으로 끌면 그 위치 시간의 상위 카드로
    (`assignTimeAt`이 이미 parentId를 null로 만들어 재사용), 미지정 구역으로 내리면 시간 없는 상위로
    (`unscheduleTodo`에 parentId 해제 추가). 승격 중엔 목표 슬롯에 실제 카드로 미리 배치되고
    원래 자리(부모 아래)에서는 숨김(`promotingSubId`).
  · **상위 → 하위 편입**: 일정카드를 잡고 **오른쪽으로 32px 이상 밀면서** 다른 카드 위에 놓으면 그
    카드의 하위일정이 됨(`DRAG_DEMOTE_DX`, `isDemoteGesture`). 세로는 이미 시간 조절에 쓰이므로
    가로 이동으로 구분. 미리보기: 대상 카드 강조 + 끌던 카드가 오른쪽으로 들여쓰기.
  · 미지정 → 카드 위 편입(기존)도 새 스토어 액션 `makeSubItemOf`로 통일 — 옮기는 카드에 하위일정이
    있으면 함께 새 부모 밑으로 평탄화(하위 1단계 유지), 대상 카드의 기존 하위 뒤에 배치.
  **101 tests green, lint/build clean.** 브라우저 검증: 상위→하위(오른쪽 밀기), 하위→시간 있는 상위,
  하위→미지정 상위, 미지정→하위(회귀), 형제 순서변경(회귀), 일반 시간 드래그(회귀) 6종.
- **Decided**: 하위 편입은 '오른쪽으로 밀기' 제스처(들여쓰기 은유). 카드 중앙 근처 = 같은 시간 스냅과
  충돌하기 때문. 되돌리려면 왼쪽으로 다시 당기면 강조가 풀린다.
- **Blocked**: 없음.
- **Next**: 아이폰 실기기에서 32px 임계값 체감(필요시 `DRAG_DEMOTE_DX` 조정). 미푸시.

## 2026-09-07 (4세션: 하위 편입 제스처 모바일 대응)
- **Done**: 하위일정 편입 제스처를 **좌우 양방향**으로 변경(`isDemoteGesture`가 |dx| 기준).
  손잡이가 카드 오른쪽 끝에 있어 모바일에서는 오른쪽으로 밀 여유가 없다는 오너 피드백 반영 —
  이제 **왼쪽으로 밀어도** 동일하게 편입된다(왼쪽은 화면 폭만큼 여유). 임계값 32→40px로 올려
  세로 드래그 중 손가락이 살짝 휘는 정도로는 발동하지 않게 함. 미리보기 카드도 민 방향으로 이동.
  **105 tests green, lint/build clean.** 브라우저 검증: 왼쪽 밀기 편입 / 오른쪽 밀기 편입(유지) /
  세로만 드래그 = 시간 재지정(편입 안 됨) 3종.
- **Decided**: 방향은 무관하게, '가로로 벗어나면 편입'. 미지정→카드 편입은 애초에 가로 이동이
  필요 없어 모바일에서 그대로 사용 가능.
- **Blocked**: 없음.
- **Next**: 실기기에서 40px 체감(오발동 잦으면 `DRAG_DEMOTE_DX` 상향). 미푸시.

## 2026-09-07 (5세션: 입력 바 아래 안전영역 틈 수정)
- **Done**: 아이폰 하단 홈 인디케이터 영역(safe-area) 틈으로 스크롤 중인 일정카드가 비쳐 보이던 문제 수정.
  원인: 입력 바(footer)가 `bottom: env(safe-area-inset-bottom)`으로 **떠 있어** 그 아래 약 34px 띠가
  비었는데, 본문(.main)은 화면 맨 아래까지 이어져 카드가 그 틈에 그대로 보였음.
  수정: 입력 바를 `bottom: 0`에 붙이고 안전영역만큼은 **입력 바 자신의 padding-bottom**으로 덮는다
  (키보드가 올라오면 padding 0 — 그 아래는 키보드가 가림). `env(safe-area-inset-bottom)`을
  `--safe-bottom` 변수로 감싸 AppShell·ViewToggle에서 함께 사용 → 브라우저에서 변수만 34px로 바꿔
  아이폰 환경을 재현·검증할 수 있게 됨.
  **검증(--safe-bottom: 34px)**: 입력 바 하단 = 화면 하단(틈 0), 바 아래로 보이는 카드 0개,
  마지막 카드도 바에 가리지 않고 끝까지 스크롤됨. 105 tests green, lint/build clean.
- **Blocked**: 없음.
- **Next**: 실기기(아이폰)에서 최종 확인. 미푸시.

## 2026-09-07 (6세션: 구분선 여백 1px · 상단바 완전 고정)
- **Done**:
  (1) 섹션 구분선(오후/저녁/자정) 상단 여백 1px 추가 — `.sectionDivider` margin-top -4px → -3px.
  (2) **상단바(날짜 탭 + 기능바) 완전 고정.** 본문(.main)만 스크롤되므로 목록 스크롤로는 원래
  움직이지 않았고, 문제는 iOS 사파리가 입력창 포커스 때 페이지 자체를 위로 끌어올리는 경우였음.
  · `body`를 `position: fixed`로 고정해 문서가 밀려날 여지를 없앰.
  · 그래도 밀리는 경우를 대비해 AppShell이 `visualViewport.offsetTop`만큼 헤더를 `translateY`로
    되돌림(기존 `useKeyboardInset` → `useViewportInsets`로 확장, 값이 바뀔 때만 리렌더).
  **검증**: 목록 끝까지 스크롤해도 헤더 top=0 유지 / 페이지가 40px 밀린 상황을 흉내내면 헤더에
  `translateY(40px)`가 붙어 화면 맨 위 유지 / 키보드(336px)+페이지밀림(28px) 동시 상황에서도
  헤더는 보이는 화면 맨 위, 입력 바는 키보드 바로 위. 105 tests green, lint/build clean.
- **Blocked**: 없음.
- **Next**: 실기기에서 키보드 올릴 때 상단바 확인. 미푸시.

## 2026-09-07 (7세션: 리팩토링 1차 — 무위험 영역)
- **Done**: 동작 변화 없는 정리만 수행.
  · 미사용 CSS 클래스 6개 삭제(MixView: cardDragOutside/subItemTime/timeLabelOverdue/warnBadge,
    TodoItem: deleteButton/warnBadge) — CSS 번들 41.4→40.4kB.
  · TodoList의 지역 복제 훅(`useNowTickLocal` + `getCurrentMinutes`) 제거 → 공용 `useNowTick` 사용.
    (공용 훅은 분 경계에 맞춰 첫 틱을 정렬해 더 정확. 목록뷰는 '실제 분'을 쓰므로 가상시간
    `useNowMinutes`와는 다른 훅이 맞다.)
  · 더 이상 호출되지 않는 스토어 액션 `setParentId` 삭제(하위 편입은 `makeSubItemOf`로 일원화).
  · MixView에 4번 복붙돼 있던 스와이프 계산을 `getSwipeVisual()`(timelineMath)로 통일하고,
    임계값을 `SWIPE_MAX_PX`/`SWIPE_TRIGGER_PX` 상수로 뽑아 훅의 판정과 같은 값을 쓰게 함.
  **110 tests green(+5), lint/build clean.** 브라우저 회귀 확인: 카드 우스와이프=내일로,
  하위 좌스와이프=삭제, 미지정 우스와이프=내일로, 목록뷰 렌더/시간색, 콘솔 에러 없음.
- **Next(오너 확인 대기)**: ① 미사용 컴포넌트 3개(DayTabs·BottomNav·DateHeader) + AppShell의
  bottomNav 분기 삭제 ② 하위일정 JSX 중복(타임라인/미지정) 공용 컴포넌트로 추출
  ③ useTimelineInteractions(847줄) 기능별 훅 분리.

## 2026-09-07 (8세션: 리팩토링 2차 — 오너 승인분)
- **Done**: 오너 승인 2건 진행(훅 분리는 보류).
  · **미사용 컴포넌트 3개 삭제**: DayTabs·BottomNav·DateHeader(+각 CSS). AppShell의 `bottomNav`
    prop 분기와 `.bottomNav` 클래스, `--bottom-nav-height` 변수도 함께 제거 → AppShell의 하단
    계산이 '입력 바 + 안전영역'만 남아 단순해짐.
  · **하위일정 JSX 중복 추출**: 타임라인/미지정 두 곳에 복사돼 있던 하위일정 UI를
    `src/components/SubItemRow.tsx` 하나로 통합(스타일은 MixView.module.css 공유).
    손잡이 유무를 `onDragStart` 유무로 제어. 그 결과 **미지정 카드의 하위일정에도 손잡이가 생겨**
    순서변경·부모변경·승격이 타임라인 하위일정과 동일하게 동작.
    MixView 505 → 406줄.
  **110 tests green, lint/build clean.** 브라우저 회귀: 하위 렌더(손잡이 포함)·클릭 편집·체크박스,
  형제 순서변경, 미지정 하위→다른 카드로 부모변경(신규), 하위→미지정 승격, 하위 좌/우 스와이프
  (삭제·내일로), 콘솔 에러 없음.
- **Note**: 완료된 하위일정은 손잡이가 비활성이라 그 위에서 끌면 스와이프로 처리됨(기존과 동일).
- **Next**: `useTimelineInteractions`(847줄) 훅 분리는 오너와 다시 논의 후 진행.

## 2026-09-07 (9세션: 배포)
- **Done**: 전체 점검 후 origin/main 푸시 → GitHub Actions 자동 배포 성공(run 34123802200).
  점검 항목: 워킹트리 클린 / lint·tsc·110 tests green / `npm ci --dry-run` 락파일 동기화 확인 /
  비공개 파일(prd.md·docs/·CLAUDE.md·.env) 미추적 확인 / 실사용 흐름 스모크(일정 추가·하위 추가·
  미루기·되돌리기) / 콘솔 에러 0.
  배포본(https://babyhipo.github.io/Things_TODO/) 확인: 상단바·'미루기' 버튼·자정 구분선 정상,
  일정 추가 동작 정상. 푸시한 커밋 8개(기능 3 + 수정 3 + 리팩토링 2).
- **Note**: 푸시 시 GitHub이 dependabot 취약점 9건(critical 1) 경고. 별도 세션에서 안전한 것부터
  하나씩(Vitest v2 / Vite 5 고정 주의).
- **Next**: 아이폰 실기기에서 이번 변경들(하위↔상위 드래그, 좌우 밀기 편입, 상단바 고정) 체감 확인.

## 2026-09-07 (10세션: Dependabot 취약점 정리 9 → 2건)
- **Done**: 의존성 보안 취약점을 **한 건씩** 업데이트(매 단계 test/lint/build 확인 후 개별 커밋).
  · **1단계 — 안전한 전이 의존성 4건**(직접 설치한 게 아니라 도구가 내부에서 쓰는 부품):
    js-yaml 4.3.0→4.3.2 / brace-expansion 1.1.14→1.1.18·5.0.7→5.0.9 / nanoid 3.3.15→3.3.18 /
    postcss 8.5.16→8.5.28. 전부 락파일만 변경, package.json 무변경, 빌드 결과물 해시 동일.
  · **2단계 — vitest 2.1.9 → 3.2.7**(오너 확인 후 진행). critical(GHSA-5xrq-8626-4rwp,
    vitest UI 서버 임의 파일 읽기/실행) 해소. **테스트 코드 수정 0건**으로 110개 그대로 통과.
    함께 vite 5.4.10 → 5.4.21(동일 메이저 내 패치)도 올라감(단, vite 자체 취약점은 미해소 — 아래 정정).
  **검증**: 매 단계 110 tests green · lint clean · build 결과물 해시 동일
  (index-D_EJM9y2.css / index-DshnnVov.js) · clean `npm ci` → test → build(CI와 동일 순서) 통과 ·
  개발 서버 앱 렌더 정상, 콘솔 에러 0.
- **중요 발견**: CLAUDE.md의 "Vitest v2 위로 올리지 말 것" 제약은 **v4 기준**이었음(v4는 vite
  ^6/7/8 요구 → vite 메이저 업그레이드 강제 → `npm ci` 깨짐). **v3는 vite ^5를 공식 지원**하므로
  해당 없음. CLAUDE.md 규칙을 "Vite 5 + Vitest 3 유지, Vitest 4 금지"로 갱신함.
- **남은 취약점: GitHub 경고 4건**(vite 3건 + esbuild 1건). 개발 서버 한정 문제이고
  (`npm run dev` 실행 중 악성 사이트가 개발 서버를 조회 가능), **배포된 GitHub Pages 정적
  사이트에는 영향 없음**(vite/esbuild가 거기서 실행되지 않음). 4건 중 2건은 윈도우 전용이라
  맥에서는 해당 없음. 해소하려면 vite 5 → 8 메이저 업그레이드 필요 — 오너가 "검사기만 교체"를
  선택해 이번 세션에서는 보류.
- **Blocked**: 없음.
- **Next**: 오너 로컬 확인 후 푸시(커밋 5개, 미푸시). 필요 시 별도 세션에서 vite 5 → 8 검토.

### 정정 (같은 날, 푸시 후 확인)
- 커밋 `fd502d1`의 메시지와 위 기록에 **"vite 5.4.21로 올라가며 vite 자체 취약점 3건 해소"**라고
  적었으나 **사실이 아님**. `npm audit` 요약 화면이 vite 항목을 esbuild 하위로 접어 표시해
  해결된 것으로 오독함. `npm audit --json` 및 GitHub Dependabot API로 재확인한 결과, vite의
  3건(경로 순회 .map / launch-editor NTLM / server.fs.deny 우회)은 **모두 유효**하며
  **vite 6.4.3 이상**에서 수정됨 — vite 5 계열에는 백포트되지 않았음. 커밋 메시지는 이미 푸시돼
  있어 히스토리를 고치지 않고 여기에 정정만 남김.
- **실제 결과: GitHub 경고 9 → 4건**(해결: js-yaml·brace-expansion·nanoid·postcss·vitest(critical) /
  잔여: vite 3건 + esbuild 1건). `npm audit`의 "2건"은 **패키지 수**, GitHub의 "4건"은
  **취약점 건수** — 세는 기준이 달라서 생긴 차이이며 둘 다 같은 상태를 가리킴.
- 결론은 불변: 잔여 4건은 개발 서버 한정(그중 2건은 윈도우 전용)이라 배포본 무관, 해소하려면
  vite 5 → 8 필요. **배포 자체는 성공**(run 34125366373, GitHub 서버에서 npm ci → test → build 통과).
