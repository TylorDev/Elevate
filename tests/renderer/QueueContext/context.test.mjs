import { describe, expect, it } from 'vitest'

import { QueueProvider, useQueue } from '../../../src/renderer/src/Contexts/QueueContext/index.ts'
import { getQueueContextValue } from '../../../src/renderer/src/Contexts/QueueContext/QueueProvider.tsx'

describe('QueueContext public contract', () => {
  it('preserves the provider and hook exports through index.ts', () => {
    expect(QueueProvider).toBeTypeOf('function')
    expect(useQueue).toBeTypeOf('function')
  })

  it('throws the provider boundary error when no context exists', () => {
    expect(() => getQueueContextValue(null)).toThrow(
      'useQueue must be used within a QueueProvider'
    )
  })
})
