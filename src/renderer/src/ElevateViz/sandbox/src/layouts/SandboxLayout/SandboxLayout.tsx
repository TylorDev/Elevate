import type { ReactNode } from 'react'
import styles from './SandboxLayout.module.scss'

interface SandboxLayoutProps {
  header: ReactNode
  diagnostics: ReactNode
  children: ReactNode
}

export function SandboxLayout({ header, diagnostics, children }: SandboxLayoutProps) {
  return (
    <div className={styles.layout}>
      <header className={styles.header}>{header}</header>
      <div className={styles.diagnostics}>{diagnostics}</div>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
