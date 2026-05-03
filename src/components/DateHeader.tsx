import styles from './DateHeader.module.css';

const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];

export function DateHeader() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const dow = DAYS_KR[now.getDay()];

  return (
    <div className={styles.container}>
      <div className={styles.dateRow}>
        <span className={styles.monthDay}>
          {y}년 {m}월 {d}일
        </span>
        <span className={styles.weekday}>{dow}요일</span>
      </div>
    </div>
  );
}
