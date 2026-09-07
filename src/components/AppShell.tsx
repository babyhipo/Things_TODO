import { type ReactNode, useEffect, useState } from 'react';
import styles from './AppShell.module.css';

interface ViewportInsets {
  /** 화면 아래쪽에서 키보드가 차지한 높이(px) */
  keyboardInset: number;
  /** 사파리가 페이지를 위로 끌어올린 양(px) — 이만큼 헤더를 내려 제자리에 붙여둔다 */
  offsetTop: number;
}

function useViewportInsets(): ViewportInsets {
  const [insets, setInsets] = useState<ViewportInsets>({ keyboardInset: 0, offsetTop: 0 });

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const gap = window.innerHeight - vv.height - vv.offsetTop;
      const next = { keyboardInset: Math.max(0, gap), offsetTop: Math.max(0, vv.offsetTop) };
      // 스크롤 이벤트가 잦으므로 값이 실제로 바뀔 때만 다시 그린다
      setInsets(prev =>
        prev.keyboardInset === next.keyboardInset && prev.offsetTop === next.offsetTop ? prev : next,
      );
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return insets;
}

interface AppShellProps {
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  bottomNav?: ReactNode;
  contentInset?: number; // footer 위에 떠있는 고정 요소의 추가 여백(px)
}

export function AppShell({ header, children, footer, bottomNav, contentInset = 0 }: AppShellProps) {
  const { keyboardInset, offsetTop } = useViewportInsets();
  const keyboardOpen = keyboardInset > 0;

  // 입력 바는 화면 맨 아래(bottom: 0)에 붙이고, 하단 안전영역만큼은 입력 바 자신이
  // 여백으로 덮는다. 예전처럼 bottom을 안전영역만큼 띄우면 그 아래 틈으로
  // 스크롤 중인 일정카드가 비쳐 보였다.
  const footerBottom = keyboardOpen
    ? `${keyboardInset}px`
    : bottomNav
      ? 'calc(var(--bottom-nav-height, 64px) + var(--safe-bottom))'
      : '0px';
  // 키보드가 올라와 있거나 하단 네비가 있으면 그 아래는 이미 가려지므로 여백 불필요
  const footerPadBottom = keyboardOpen || bottomNav ? '0px' : 'var(--safe-bottom)';

  return (
    <div className={styles.outer}>
      <div className={styles.app}>
        {header ? (
          <header
            className={styles.header}
            // 페이지가 위로 밀린 만큼 되돌려, 어떤 상황에서도 상단바가 화면 맨 위에 붙어 있게 한다
            style={offsetTop > 0 ? { transform: `translateY(${offsetTop}px)` } : undefined}
          >
            {header}
          </header>
        ) : null}

        <main
          className={styles.main}
          style={{
            paddingBottom: `calc(
              ${bottomNav ? 'var(--bottom-nav-height, 64px)' : '0px'}
              + ${footer ? '68px' : '0px'}
              + ${contentInset > 0 ? `${contentInset}px` : '0px'}
              + var(--safe-bottom)
            )`,
          }}
        >
          {children}
        </main>

        {footer ? (
          <div
            className={styles.footer}
            style={{
              bottom: footerBottom,
              paddingBottom: footerPadBottom,
              transition: 'bottom 80ms ease-out',
            }}
          >
            {footer}
          </div>
        ) : null}

        {bottomNav ? <div className={styles.bottomNav}>{bottomNav}</div> : null}
      </div>
    </div>
  );
}
