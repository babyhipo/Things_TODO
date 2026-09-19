// 공유 링크로 들어왔을 때만 보이는 "보기 전용" 화면.
// 받는 사람의 원래 일정(저장된 데이터)은 읽지도 바꾸지도 않는다.
import { formatShareDate, type SharedDay, type SharedItem } from '../lib/shareCodec';
import { formatTime } from '../lib/timeFormatter';
import { StarIcon, STAR_COLOR, STAR_DONE_COLOR } from './StarIcon';
import { LinkIcon } from './LinkIcon';
import styles from './SharedView.module.css';

interface SharedViewProps {
  /** 풀린 공유 일정. null이면 링크가 망가진 경우 */
  day: SharedDay | null;
  onExit: () => void;
}

function EyeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// 체크 표시(보기 전용이라 누를 수 없음): 완료면 파란 원+체크, 별이면 별
function Mark({ item, small }: { item: SharedItem; small?: boolean }) {
  if (item.starred) {
    // 글이 길어도 별이 찌그러지지 않게 감싸서 크기 고정
    return (
      <span className={styles.star}>
        <StarIcon size={small ? 13 : 15} color={item.completed ? STAR_DONE_COLOR : STAR_COLOR} />
      </span>
    );
  }
  return (
    <span className={`${styles.check} ${small ? styles.checkSmall : ''} ${item.completed ? styles.checkDone : ''}`} aria-hidden="true">
      {item.completed && (
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6.2l2.3 2.3 4.7-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

export function SharedView({ day, onExit }: SharedViewProps) {
  const total = day ? day.items.reduce((n, it) => n + 1 + it.subs.length, 0) : 0;
  const done = day ? day.items.reduce((n, it) => n + (it.completed ? 1 : 0) + it.subs.filter((s) => s.completed).length, 0) : 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.badges}>
          <span className={styles.sharedBadge}><LinkIcon size={12} /> 공유받은 일정</span>
          <span className={styles.readOnly}><EyeIcon /> 보기 전용</span>
        </div>
        {day ? (
          <>
            <h1 className={styles.date}>{formatShareDate(day.date)}</h1>
            <p className={styles.summary}>일정 {total}개{done > 0 ? ` · 완료 ${done}개` : ''}</p>
          </>
        ) : (
          <>
            <h1 className={styles.date}>일정을 열 수 없어요</h1>
            <p className={styles.summary}>링크가 잘렸거나 잘못된 것 같아요. 보낸 사람에게 다시 받아 주세요.</p>
          </>
        )}
      </header>

      <ul className={styles.list}>
        {day?.items.map((it, i) => (
          <li key={i} className={styles.item}>
            <div className={styles.row}>
              <span className={styles.time}>
                {it.time !== null && formatTime(it.time)}
                {it.endTime !== null && <><br />~{formatTime(it.endTime)}</>}
              </span>
              <div className={styles.card}>
                <Mark item={it} />
                <span className={`${styles.text} ${it.completed ? styles.textDone : ''}`}>{it.text}</span>
              </div>
            </div>
            {it.subs.map((s, j) => (
              <div key={j} className={`${styles.row} ${styles.subRow}`}>
                <div className={`${styles.card} ${styles.subCard}`}>
                  <Mark item={s} small />
                  <span className={`${styles.text} ${s.completed ? styles.textDone : ''}`}>{s.text}</span>
                </div>
              </div>
            ))}
          </li>
        ))}
      </ul>

      <div className={styles.bottomBar}>
        <button type="button" className={styles.exitBtn} onClick={onExit}>
          내 일정으로 돌아가기
        </button>
      </div>
    </div>
  );
}
