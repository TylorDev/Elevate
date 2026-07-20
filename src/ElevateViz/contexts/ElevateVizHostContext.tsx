import { createContext, useContext } from 'react'
import { electronVisualizerPersistence } from '../services/visualizerService'
import type { ElevateVizHostProps, VisualizerPersistence } from '../types'

type IntegrationValue = Omit<ElevateVizHostProps, 'children' | 'persistence'> & {
  persistence: VisualizerPersistence
}

const ElevateVizHostContext = createContext<IntegrationValue | null>(null)

export function ElevateVizIntegrationProvider({
  children,
  persistence = electronVisualizerPersistence,
  ...value
}: ElevateVizHostProps) {
  return (
    <ElevateVizHostContext.Provider value={{ ...value, persistence }}>
      {children}
    </ElevateVizHostContext.Provider>
  )
}

export function useElevateVizIntegration(): IntegrationValue {
  const value = useContext(ElevateVizHostContext)

  if (!value) {
    throw new Error('ElevateViz must be rendered inside ElevateVizHost')
  }

  return value
}
