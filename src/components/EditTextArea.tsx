import {
  type KeyboardEvent,
  type MutableRefObject,
  useLayoutEffect,
} from 'react';
import styles from './EditTextArea.module.css';

interface EditTextAreaProps {
  value: string;
  onChange: (value: string) => void;
  /** 엔터 = 저장 */
  onCommit: () => void;
  /** ESC = 취소 */
  onCancel: () => void;
  onBlur: () => void;
  /** 엔터/ESC 외의 키 처리(예: 리스트 보기의 Tab 들여쓰기) */
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  inputRef: MutableRefObject<HTMLTextAreaElement | null>;
  className?: string;
  /** 카드 안에서 누를 때 카드 드래그/스와이프가 시작되지 않게 막기 */
  stopPointer?: boolean;
}

/**
 * 일정 수정칸. 한 줄 입력칸(<input>)은 긴 글의 앞부분이 칸 밖으로 밀려 안 보였기 때문에,
 * 글 길이에 맞춰 높이가 늘어나는 <textarea>로 전체 글을 보여준다.
 * 일정은 한 줄짜리라 줄바꿈 문자는 넣지 않는다(붙여넣은 줄바꿈은 띄어쓰기로 바꿈).
 */
export function EditTextArea({
  value, onChange, onCommit, onCancel, onBlur, onKeyDown, inputRef, className, stopPointer = false,
}: EditTextAreaProps) {
  // 글이 바뀔 때마다 높이를 내용에 맞춤 (화면에 그리기 전에 맞춰서 깜빡임 없음)
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    // scrollHeight엔 테두리(밑줄)가 빠져 있어 그만큼 더해야 스크롤이 안 생김
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [value, inputRef]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      // 한글 조합 중에 누른 엔터는 글자 확정용이므로 저장하지 않음
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      onCommit();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }
    onKeyDown?.(e);
  };

  return (
    <textarea
      ref={inputRef}
      rows={1}
      className={`${styles.textarea} ${className ?? ''}`}
      value={value}
      onChange={e => onChange(e.target.value.replace(/\r?\n/g, ' '))}
      onKeyDown={handleKeyDown}
      onBlur={onBlur}
      onPointerDown={stopPointer ? (e => e.stopPropagation()) : undefined}
      autoComplete="off"
      enterKeyHint="done"
    />
  );
}
