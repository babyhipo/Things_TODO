import { type ReactNode, useEffect, useState } from 'react';
import styles from './AppShell.module.css';

function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const gap = window.innerHeight - vv.height - vv.offsetTop;
      setInset(Math.max(0, gap));
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return inset;
}

interface AppShellProps {
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  bottomNav?: ReactNode;
  contentInset?: number; // footer 위에 떠있는 고정 요소의 추가 여백(px)
}

export function AppShell({ header, children, footer, bottomNav, contentInset = 0 }: AppShellProps) {
  const keyboardInset = useKeyboardInset();
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
        {header ? <header className={styles.header}>{header}</header> : null}

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
