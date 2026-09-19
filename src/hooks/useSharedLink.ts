import { useCallback, useEffect, useState } from 'react';
import { decodeSharedDay, readShareCode, type SharedDay } from '../lib/shareCodec';

type SharedLinkState =
  | { status: 'none' }                        // 공유 링크가 아님 → 평소 앱
  | { status: 'loading' }                     // 링크 푸는 중
  | { status: 'ready'; day: SharedDay | null }; // 풀기 끝(null = 망가진 링크)

/**
 * 주소에 #share=... 가 있으면 공유 일정을 풀어서 돌려준다.
 * exit()은 주소에서 #share 부분을 지우고 평소 앱으로 돌아간다.
 */
export function useSharedLink() {
  const [code, setCode] = useState<string | null>(() => readShareCode(window.location.hash));
  const [state, setState] = useState<SharedLinkState>(() => (code ? { status: 'loading' } : { status: 'none' }));

  // 앱이 열린 상태에서 공유 링크를 또 열 때(주소 # 부분만 바뀜) 대비
  useEffect(() => {
    const onHash = () => setCode(readShareCode(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!code) {
      setState({ status: 'none' });
      return;
    }
    let alive = true;
    setState({ status: 'loading' });
    decodeSharedDay(code).then((day) => {
      if (alive) setState({ status: 'ready', day });
    });
    return () => { alive = false; };
  }, [code]);

  const exit = useCallback(() => {
    // 새로고침 없이 주소만 정리 (뒤로가기 기록도 남기지 않음)
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setCode(null);
  }, []);

  return { state, exit };
}
