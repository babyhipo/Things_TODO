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

  const footerBottom = keyboardOpen
    ? `${keyboardInset}px`
    : bottomNav
      ? 'calc(var(--bottom-nav-height, 64px) + env(safe-area-inset-bottom))'
      : 'env(safe-area-inset-bottom)';

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
              + env(safe-area-inset-bottom)
            )`,
          }}
        >
          {children}
        </main>

        {footer ? (
          <div
            className={styles.footer}
            style={{ bottom: footerBottom, transition: 'bottom 80ms ease-out' }}
          >
            {footer}
          </div>
        ) : null}

        {bottomNav ? <div className={styles.bottomNav}>{bottomNav}</div> : null}
      </div>
    </div>
  );
}
