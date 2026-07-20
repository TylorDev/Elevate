import { ElevateVizIntegrationProvider } from '../../contexts/ElevateVizHostContext'
import { VisualizerProvider } from '../../contexts/VisualizerContext'
import type { ElevateVizHostProps } from '../../types'
import './ElevateVizHost.module.scss'

export function ElevateVizHost(props: ElevateVizHostProps) {
  const { children } = props

  return (
    <ElevateVizIntegrationProvider {...props}>
      <VisualizerProvider>{children}</VisualizerProvider>
    </ElevateVizIntegrationProvider>
  )
}
