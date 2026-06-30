import { buildProbeResult, DEFAULT_NATIVE_PROBES } from './probes.ts'
import type {
  NativeDiagnosticsApp,
  NativeDiagnosticsLogger,
  NativeDiagnosticsReport,
  NativeProbe
} from '../../Types/nativeDiagnostics.ts'

export type * from '../../Types/nativeDiagnostics.ts'

export function runNativeBindingDiagnostics(
  log: NativeDiagnosticsLogger,
  app: NativeDiagnosticsApp,
  probes: NativeProbe[] = DEFAULT_NATIVE_PROBES
): NativeDiagnosticsReport {
  const diagnostics: NativeDiagnosticsReport = {
    app: {
      isPackaged: Boolean(app?.isPackaged),
      appPath: typeof app?.getAppPath === 'function' ? app.getAppPath() : null
    },
    process: {
      platform: process.platform,
      arch: process.arch,
      versions: process.versions,
      resourcesPath: process.resourcesPath || null,
      execPath: process.execPath
    },
    probes: probes.map(buildProbeResult)
  }

  log.info('[native diagnostics]', JSON.stringify(diagnostics))

  for (const probe of diagnostics.probes) {
    if (probe.loadResult && !probe.loadResult.ok) {
      log.error(`[native diagnostics] Failed to load ${probe.name}:`, JSON.stringify(probe))
    }
  }

  return diagnostics
}
