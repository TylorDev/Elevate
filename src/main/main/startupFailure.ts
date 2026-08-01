export interface StartupFailureDialog {
  title: string
  content: string
}

function readErrorValue(error: unknown, property: string): unknown {
  return error && typeof error === 'object' ? Reflect.get(error, property) : undefined
}

function getErrorMessage(error: unknown): string {
  const message = readErrorValue(error, 'message')
  if (typeof message === 'string' && message.trim()) return message.trim()
  return typeof error === 'string' && error.trim() ? error.trim() : 'Error de inicio desconocido.'
}

export function isMissingWindowsRuntimeStartupError(
  error: unknown,
  platform: NodeJS.Platform = process.platform
): boolean {
  if (platform !== 'win32') return false

  const code = readErrorValue(error, 'code')
  const details = `${getErrorMessage(error)} ${String(readErrorValue(error, 'stack') || '')}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  return (
    code === 'ERR_DLOPEN_FAILED' ||
    details.includes('vcruntime140.dll') ||
    details.includes('msvcp140.dll') ||
    details.includes('the specified module could not be found') ||
    details.includes('no se puede encontrar el modulo especificado')
  )
}

export function createStartupFailureDialog(
  error: unknown,
  platform: NodeJS.Platform = process.platform
): StartupFailureDialog {
  const detail = getErrorMessage(error)

  if (isMissingWindowsRuntimeStartupError(error, platform)) {
    return {
      title: 'Elevate necesita Microsoft Visual C++',
      content: [
        'Elevate no puede iniciarse porque falta o está dañado Microsoft Visual C++ Redistributable x64.',
        '',
        'Vuelve a ejecutar el instalador de Elevate y acepta la solicitud de administrador para reparar el componente requerido.',
        '',
        `Detalle: ${detail}`
      ].join('\n')
    }
  }

  return {
    title: 'Elevate no pudo iniciarse',
    content: [
      'Ocurrió un error antes de que Elevate pudiera abrir su ventana.',
      '',
      'Vuelve a instalar Elevate. Si el problema continúa, adjunta este detalle al reporte del error:',
      '',
      detail
    ].join('\n')
  }
}
