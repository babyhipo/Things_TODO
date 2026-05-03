import { type ReactNode } from 'react';
import styles from './AppShell.module.css';

interface AppShellProps {
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  bottomNav?: ReactNode;
}

export function AppShell({ header, children, footer, bottomNav }: AppShellProps) {
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
              + env(safe-area-inset-bottom)
            )`,
          }}
        >
          {children}
        </main>

        {footer ? (
          <div
            className={styles.footer}
            style={{
              bottom: bottomNav
                ? 'calc(var(--bottom-nav-height, 64px) + env(safe-area-inset-bottom))'
                : 'env(safe-area-inset-bottom)',
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
