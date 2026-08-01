import { useEffect, useRef, useState, type ReactNode } from 'react'
import { toast } from 'react-toastify'
import type { PrismaStatus } from '../../../../main/Types/main'
import styles from './DatabaseGate.module.scss'

type DatabaseGateProps = {
  children: ReactNode
}

export default function DatabaseGate({ children }: DatabaseGateProps) {
  const [status, setStatus] = useState<PrismaStatus | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const notifiedReset = useRef(false)

  useEffect(() => {
    let mounted = true
    void window.electron.appDiagnostics.getDatabaseStatus().then((nextStatus) => {
      if (mounted) setStatus(nextStatus)
    })

    const unsubscribe = window.electron.appDiagnostics.onDatabaseStatus((nextStatus) => {
      if (mounted) setStatus(nextStatus)
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!status?.isReady || !status.recovery.resetPerformed || notifiedReset.current) return
    notifiedReset.current = true
    const timeoutId = window.setTimeout(() => {
      toast.warning(
        status.recovery.backupAvailable
          ? 'La base de datos se restauró. Se guardó una copia de seguridad.'
          : 'La base de datos se restauró desde la plantilla.'
      )
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [status])

  const retry = async () => {
    setIsRetrying(true)
    try {
      setStatus(await window.electron.appDiagnostics.retryDatabase())
    } finally {
      setIsRetrying(false)
    }
  }

  if (status?.isReady) {
    return children
  }

  const isLoading = !status || status.isInitializing || status.phase === 'preparing'

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-live="polite">
        <div className={styles.signal} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className={styles.eyebrow}>Elevate data layer</p>
        <h1>{isLoading ? 'Preparando tu biblioteca' : 'La base de datos no está disponible'}</h1>
        <p className={styles.description}>
          {isLoading
            ? 'Estamos verificando la integridad y la versión de SQLite antes de abrir la aplicación.'
            : status?.error?.message || 'No se pudo iniciar el almacenamiento local.'}
        </p>

        {!isLoading && (
          <div className={styles.actions}>
            {status?.error?.retryable && (
              <button
                type="button"
                className={styles.primary}
                onClick={retry}
                disabled={isRetrying}
              >
                {isRetrying ? 'Reintentando…' : 'Reintentar'}
              </button>
            )}
            {status?.recovery.backupAvailable && (
              <button
                type="button"
                className={styles.secondary}
                onClick={() => void window.electron.appDiagnostics.openDatabaseBackups()}
              >
                Abrir respaldos
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
