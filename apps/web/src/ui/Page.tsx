import type { ReactNode } from 'react';
import { cx } from './index';
import l from './layout.module.css';

export function Page({ title, action, lead, bare, children }: { title?: ReactNode; action?: ReactNode; lead?: ReactNode; bare?: boolean; children: ReactNode }) {
  return (
    <main className={cx(l.page, bare && l.pageBare)}>
      {(title || action || lead) && (
        <header className={l.header}>
          <div className={l.row} style={{ minWidth: 0 }}>
            {lead}
            {typeof title === 'string' ? <h1 className={l.title}>{title}</h1> : title}
          </div>
          {action}
        </header>
      )}
      {children}
    </main>
  );
}

export { l as layout };
