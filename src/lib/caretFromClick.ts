// 일정 글자를 눌러 수정을 시작할 때, 누른 위치가 글의 몇 번째 글자인지 계산한다.
// 수정칸이 열리면 커서를 그 자리에 둬서 긴 글의 앞/중간 부분도 바로 고칠 수 있게 함.

type CaretPoint = { node: Node; offset: number };

// 브라우저마다 이름이 다름: 표준 caretPositionFromPoint / 사파리·옛 크롬 caretRangeFromPoint
function caretPointAt(x: number, y: number): CaretPoint | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(x, y);
    return pos ? { node: pos.offsetNode, offset: pos.offset } : null;
  }
  if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(x, y);
    return range ? { node: range.startContainer, offset: range.startOffset } : null;
  }
  return null;
}

/**
 * 클릭한 지점이 요소(e.currentTarget) 글 안에서 몇 번째 글자 위치인지 돌려준다.
 * 키보드로 누른 경우·요소 밖·계산 불가면 null (→ 호출 쪽에서 커서를 맨 끝에 둠).
 */
export function caretFromClick(e: React.MouseEvent<HTMLElement>): number | null {
  // 키보드(엔터/스페이스)로 누른 클릭은 좌표가 없음
  if (e.detail === 0) return null;
  const container = e.currentTarget;
  const point = caretPointAt(e.clientX, e.clientY);
  if (!point || !container.contains(point.node)) return null;
  try {
    // 요소 맨 앞부터 누른 지점까지의 글자 수
    const range = document.createRange();
    range.setStart(container, 0);
    range.setEnd(point.node, point.offset);
    return range.toString().length;
  } catch {
    return null;
  }
}
