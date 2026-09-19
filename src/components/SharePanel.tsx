import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTodoStore } from '../store/useTodoStore';
import { getLogicalDate } from '../lib/dayBoundary';
import {
  addDaysYMD,
  buildShareText,
  buildShareUrl,
  buildSharedItems,
  byTimeThenOrder,
  encodeSharedDay,
  formatShareTime,
  type SharedDay,
} from '../lib/shareCodec';
import { StarIcon, STAR_COLOR, STAR_DONE_COLOR } from './StarIcon';
import styles from './SharePanel.module.css';
import type { DayKey, Todo } from '../types/todo';

interface SharePanelProps {
  open: boolean;
  day: DayKey;
  onClose: () => void;
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span className={`${styles.box} ${checked ? styles.boxOn : ''}`} aria-hidden="true">
      {checked && (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6.2l2.3 2.3 4.7-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

// 앱 주소: 개발 중엔 localhost, 배포본은 https://babyhipo.github.io/Things_TODO/
function appUrl(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}

export function SharePanel({ open, day, onClose }: SharePanelProps) {
  const todos = useTodoStore((s) => s.days[day]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 선택 창에 보여줄 순서: 큰 일정 시간순, 그 밑에 하위 일정
  const groups = useMemo(() => {
    const parents = todos.filter((t) => t.parentId === null).sort(byTimeThenOrder);
    return parents.map((p) => ({
      parent: p,
      children: todos.filter((t) => t.parentId === p.id).sort((a, b) => a.order - b.order),
    }));
  }, [todos]);

  // 창이 열릴 때마다 전부 체크된 상태로 시작
  useEffect(() => {
    if (open) {
      setSelected(new Set(todos.map((t) => t.id)));
      setCopied(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 열릴 때 한 번만
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const sharedDay: SharedDay = useMemo(() => {
    const today = getLogicalDate();
    return {
      date: day === 'today' ? today : addDaysYMD(today, 1),
      items: buildSharedItems(todos, selected),
    };
  }, [todos, selected, day]);

  const count = sharedDay.items.reduce((n, it) => n + 1 + it.subs.length, 0);

  // 링크는 체크가 바뀔 때마다 미리 만들어 둔다.
  // (아이폰은 버튼을 누른 "그 순간"에 공유창을 열어야 해서, 누른 뒤 압축하면 막힐 수 있음)
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setShareUrl(null);
    encodeSharedDay(sharedDay).then((code) => {
      if (alive) setShareUrl(buildShareUrl(appUrl(), code));
    });
    return () => { alive = false; };
  }, [open, sharedDay]);

  const toggleParent = (p: Todo, children: Todo[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const on = !prev.has(p.id);
      // 큰 일정을 끄면 하위 일정도 같이 꺼지고, 켜면 같이 켜진다
      for (const t of [p, ...children]) {
        if (on) next.add(t.id); else next.delete(t.id);
      }
      return next;
    });
  };

  const toggleChild = (c: Todo) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (prev.has(c.id)) {
        next.delete(c.id);
      } else {
        next.add(c.id);
        if (c.parentId) next.add(c.parentId); // 하위만 켜면 부모도 같이 켜짐
      }
      return next;
    });
  };

  const allOn = todos.length > 0 && selected.size === todos.length;
  const toggleAll = () => setSelected(allOn ? new Set() : new Set(todos.map((t) => t.id)));

  const handleShare = async () => {
    if (!shareUrl || count === 0) return;
    const text = buildShareText(sharedDay);
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: '공유받은 일정', text, url: shareUrl });
        onClose();
        return;
      } catch (e) {
        // 공유창에서 취소한 경우는 그대로 둔다
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    // 공유창이 없는 곳(PC 등): 글과 링크를 복사
    try {
      await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('아래 링크를 복사해 주세요', shareUrl);
    }
  };

  const title = day === 'today' ? '오늘 일정 공유' : '내일 일정 공유';
  const buttonLabel = copied
    ? '링크 복사됨'
    : count === 0
      ? '공유할 일정을 골라 주세요'
      : `${count}개 공유하기`;

  return createPortal(
    <>
      <div
        className={`${styles.backdrop} ${open ? styles.backdropOpen : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`${styles.sheet} ${open ? styles.sheetOpen : ''}`}
        role="dialog"
        aria-label={title}
        aria-hidden={!open}
      >
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
          {todos.length > 0 && (
            <button type="button" className={styles.allBtn} onClick={toggleAll}>
              {allOn ? '전체 해제' : '전체 선택'}
            </button>
          )}
        </div>

        <div className={styles.list}>
          {todos.length === 0 && <p className={styles.empty}>공유할 일정이 없어요.</p>}
          {groups.map(({ parent, children }) => (
            <div key={parent.id}>
              <Row todo={parent} checked={selected.has(parent.id)} onToggle={() => toggleParent(parent, children)} />
              {children.map((c) => (
                <Row key={c.id} todo={c} sub checked={selected.has(c.id)} onToggle={() => toggleChild(c)} />
              ))}
            </div>
          ))}
        </div>

        <div className={styles.bottomBar}>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="닫기">×</button>
          <button
            type="button"
            className={styles.shareBtn}
            onClick={handleShare}
            disabled={count === 0 || !shareUrl}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

function Row({ todo, checked, sub, onToggle }: { todo: Todo; checked: boolean; sub?: boolean; onToggle: () => void }) {
  const time = formatShareTime({ time: todo.time, endTime: todo.endTime ?? null });
  return (
    <button
      type="button"
      className={`${styles.row} ${sub ? styles.rowSub : ''} ${checked ? '' : styles.rowOff}`}
      onClick={onToggle}
      aria-pressed={checked}
    >
      <CheckBox checked={checked} />
      {!sub && <span className={styles.time}>{time}</span>}
      <span className={`${styles.text} ${todo.completed ? styles.textDone : ''}`}>{todo.text}</span>
      {todo.starred && (
        <span className={styles.star}>
          <StarIcon size={13} color={todo.completed ? STAR_DONE_COLOR : STAR_COLOR} />
        </span>
      )}
    </button>
  );
}
