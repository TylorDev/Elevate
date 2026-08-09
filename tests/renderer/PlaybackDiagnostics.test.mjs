import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import {
  INITIAL_DIAGNOSTIC_EXPORT_STATE,
  PlaybackDiagnosticsView
} from '../../src/renderer/src/components/PlaybackDiagnostics/PlaybackDiagnostics.tsx'

function renderState(exportState) {
  return renderToStaticMarkup(
    React.createElement(PlaybackDiagnosticsView, { exportState, onExport: vi.fn() })
  )
}

describe('PlaybackDiagnostics component states', () => {
  it('renders the full-path privacy warning and enabled export action initially', () => {
    const markup = renderState(INITIAL_DIAGNOSTIC_EXPORT_STATE)

    expect(markup).toContain('Export diagnostic ZIP')
    expect(markup).toContain('full local music paths')
    expect(markup).toContain('never includes the SQLite database')
    expect(markup).not.toContain('disabled=""')
  })

  it('disables the action and exposes progress while exporting', () => {
    const markup = renderState({ status: 'exporting', message: 'Preparing diagnostic archive…' })

    expect(markup).toContain('disabled=""')
    expect(markup).toContain('Exporting…')
    expect(markup).toContain('Preparing diagnostic archive…')
  })

  it.each([
    [{ status: 'success', message: 'Saved to C:\\Temp\\diagnostics.zip' }, 'Saved to'],
    [{ status: 'error', message: 'Disk unavailable' }, 'Disk unavailable']
  ])('renders the %s result state through its live status', (state, expected) => {
    const markup = renderState(state)

    expect(markup).toContain('aria-live="polite"')
    expect(markup).toContain(expected)
    expect(markup).toContain('Export diagnostic ZIP')
  })
})
