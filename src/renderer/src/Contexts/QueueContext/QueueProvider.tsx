import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { AudioFileInfo } from '../../../../main/Types/filehandlers.ts'
import type {
  ManualQueueOrders,
  QueueContextValue,
  QueueIpcInvoker,
  QueueProviderProps,
  QueueState,
  QueueTranslator
} from '../../Types/QueueContextTypes/index.ts'
import { useI18n } from '../I18nContext'
import { electronInvoke } from '../utils'
import { createQueueControlActions } from './queueControls.ts'
import { createQueueMutations } from './queueMutations.ts'
import { createQueueNotifications } from './queueNotifications.ts'
import { createQueuePlaybackActions } from './queuePlayback.ts'
import { createQueueStateActions } from './queueState.ts'
import {
  EMPTY_QUEUE_STATE,
  normalizeBoolean,
  normalizeCurrentFile,
  normalizeIndex,
  normalizeManualQueueOrders,
  normalizeQueueState,
  readStorageValue,
  writeStorageValue
} from './queueStorage.ts'

export const QueueContext = createContext<QueueContextValue | null>(null)

export function getQueueContextValue(context: QueueContextValue | null): QueueContextValue {
  if (!context) {
    throw new Error('useQueue must be used within a QueueProvider')
  }

  return context
}

export function QueueProvider({ children }: QueueProviderProps) {
  const navigate = useNavigate()
  const { t } = useI18n() as { t: QueueTranslator }
  const [queueState, setQueueState] = useState<QueueState>(() =>
    readStorageValue('queueState', EMPTY_QUEUE_STATE, normalizeQueueState)
  )
  const [currentFile, setCurrentFile] = useState<AudioFileInfo | null>(() =>
    readStorageValue('currentFile', null, normalizeCurrentFile)
  )
  const [currentIndex, setCurrentIndex] = useState<number>(() =>
    readStorageValue('currentIndex', 0, (value) => normalizeIndex(value))
  )
  const [isShuffled, setIsShuffled] = useState<boolean>(() =>
    readStorageValue('audioControls.shuffled', false, (value) => normalizeBoolean(value))
  )
  const [manualQueueOrders, setManualQueueOrders] = useState<ManualQueueOrders>(() =>
    readStorageValue('manualQueueOrders', {}, normalizeManualQueueOrders)
  )

  useEffect(() => {
    writeStorageValue('queueState', queueState)
  }, [queueState])

  useEffect(() => {
    writeStorageValue('currentFile', currentFile)
  }, [currentFile])

  useEffect(() => {
    writeStorageValue('currentIndex', currentIndex)
  }, [currentIndex])

  useEffect(() => {
    writeStorageValue('audioControls.shuffled', isShuffled)
  }, [isShuffled])

  useEffect(() => {
    writeStorageValue('manualQueueOrders', manualQueueOrders)
  }, [manualQueueOrders])

  const invoke = useCallback<QueueIpcInvoker>(
    (channel, ...args) => window.electron.ipcRenderer.invoke(channel, ...args),
    []
  )

  const invokeMutation = useCallback<QueueIpcInvoker>(
    (channel, ...args) => electronInvoke(channel, ...args),
    []
  )

  const notifications = useMemo(() => createQueueNotifications(t), [t])

  const stateActions = useMemo(
    () =>
      createQueueStateActions({
        currentFile,
        currentIndex,
        isShuffled,
        setQueueState,
        setCurrentFile,
        setCurrentIndex,
        setIsShuffled,
        notifyRemoved: notifications.notifyRemoved
      }),
    [currentFile, currentIndex, isShuffled, notifications.notifyRemoved]
  )

  const controlActions = useMemo(
    () =>
      createQueueControlActions({
        queueState,
        currentFile,
        currentIndex,
        isShuffled,
        setQueueState,
        setCurrentFile,
        setCurrentIndex,
        setIsShuffled,
        navigateToMusic: () => navigate('/music')
      }),
    [currentFile, currentIndex, isShuffled, navigate, queueState]
  )

  const playbackActions = useMemo(
    () =>
      createQueuePlaybackActions({
        applyBaseQueue: stateActions.applyBaseQueue,
        invoke,
        navigate,
        setCurrentFile,
        setCurrentIndex
      }),
    [invoke, navigate, stateActions.applyBaseQueue]
  )

  const mutationActions = useMemo(
    () =>
      createQueueMutations({
        currentFile,
        currentIndex,
        isShuffled,
        invoke: invokeMutation,
        setQueueState,
        setCurrentFile,
        setCurrentIndex,
        notify: notifications
      }),
    [currentFile, currentIndex, invokeMutation, isShuffled, notifications]
  )

  const contextValue = useMemo<QueueContextValue>(
    () => ({
      queueState,
      setQueueState,
      currentFile,
      setCurrentFile,
      currentIndex,
      setCurrentIndex,
      isShuffled,
      setIsShuffled,
      manualQueueOrders,
      setManualQueueOrders,
      ...stateActions,
      ...controlActions,
      ...playbackActions,
      ...mutationActions
    }),
    [
      controlActions,
      currentFile,
      currentIndex,
      isShuffled,
      manualQueueOrders,
      mutationActions,
      playbackActions,
      queueState,
      stateActions
    ]
  )

  return <QueueContext.Provider value={contextValue}>{children}</QueueContext.Provider>
}

export function useQueue(): QueueContextValue {
  return getQueueContextValue(useContext(QueueContext))
}
