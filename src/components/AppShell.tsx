import { type ReactNode } from 'react';
import styles from './AppShell.module.css';

interface AppShellProps {
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function AppShell({ header, children, footer }: AppShellProps) {
  return (
    <div className={styles.outer}>
      <div className={styles.app}>
        {header ? <header className={styles.header}>{header}</header> : null}
        <main className={`${styles.main} ${footer ? styles.mainWithFooter : ''}`}>
          {children}
        </main>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>
  );
}
