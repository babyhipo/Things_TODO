import { useEffect, useState } from 'react';
import { DAY_START_MIN } from '../lib/dayBoundary';

/** 현재 시각을 '가상 시간'(분)으로 반환. 새벽(4시 이전)은 하루 끝으로 밀린 값. */
export function getCurrentMinutes(): number {
  const d = new Date();
  const total = d.getHours() * 60 + d.getMinutes();
  return total < DAY_START_MIN ? total + 1440 : total;
}

/** 1분마다 갱신되는 현재 가상 시각(분) 훅. */
export function useNowMinutes(): number {
  const [now, setNow] = useState(getCurrentMinutes);
  useEffect(() => {
    const t = setInterval(() => setNow(getCurrentMinutes()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}
