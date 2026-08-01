!ifndef BUILD_UNINSTALLER
  !include FileFunc.nsh
  !include LogicLib.nsh
  !include WordFunc.nsh

  !define VC_RUNTIME_INSTALLER "vc_redist.x64.exe"
  !define VC_RUNTIME_REGISTRY_KEY "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64"

  Var VcRuntimeBundledVersion
  Var VcRuntimeExitCode
  Var VcRuntimeInstallArguments

  Function IsRequiredVcRuntimeInstalled
    ReadRegDWORD $0 HKLM "${VC_RUNTIME_REGISTRY_KEY}" "Installed"
    ReadRegStr $1 HKLM "${VC_RUNTIME_REGISTRY_KEY}" "Version"

    ${If} $0 != 1
    ${OrIf} $1 == ""
      Push "0"
      Return
    ${EndIf}

    StrCpy $2 $1 1
    ${If} $2 == "v"
    ${OrIf} $2 == "V"
      StrCpy $1 $1 "" 1
    ${EndIf}

    ${VersionCompare} $1 $VcRuntimeBundledVersion $2
    ${If} $2 == 0
    ${OrIf} $2 == 1
      Push "1"
      Return
    ${EndIf}

    Push "0"
  FunctionEnd

  !macro customInstallMode
    ; Preserve the existing per-user installation without an Elevate-specific UAC prompt.
    StrCpy $isForceCurrentInstall "1"
  !macroend

  !macro customInit
    InitPluginsDir
    File /oname=$PLUGINSDIR\${VC_RUNTIME_INSTALLER} "${BUILD_RESOURCES_DIR}\redist\${VC_RUNTIME_INSTALLER}"
    ${GetFileVersion} "$PLUGINSDIR\${VC_RUNTIME_INSTALLER}" $VcRuntimeBundledVersion

    ${If} $VcRuntimeBundledVersion == ""
      ${IfNot} ${Silent}
        MessageBox MB_ICONSTOP|MB_OK "El instalador de Microsoft Visual C++ incluido no es válido. Descarga nuevamente el instalador de Elevate."
      ${EndIf}
      SetErrorLevel 2
      Quit
    ${EndIf}

    Call IsRequiredVcRuntimeInstalled
    Pop $0
    ${If} $0 == "1"
      DetailPrint "Microsoft Visual C++ Redistributable x64 $VcRuntimeBundledVersion or newer is already installed."
      Delete "$PLUGINSDIR\${VC_RUNTIME_INSTALLER}"
      Goto ElevateVcRuntimeReady
    ${EndIf}

    ElevateVcRuntimeInstall:
      DetailPrint "Installing Microsoft Visual C++ Redistributable x64 $VcRuntimeBundledVersion..."

      ${If} ${Silent}
        StrCpy $VcRuntimeInstallArguments '/install /quiet /norestart /log "$TEMP\Elevate-vc-redist.log"'
      ${Else}
        StrCpy $VcRuntimeInstallArguments '/install /passive /norestart /log "$TEMP\Elevate-vc-redist.log"'
      ${EndIf}

      ClearErrors
      ExecWait '"$PLUGINSDIR\${VC_RUNTIME_INSTALLER}" $VcRuntimeInstallArguments' $VcRuntimeExitCode
      ${If} ${Errors}
        StrCpy $VcRuntimeExitCode 1
      ${EndIf}

      ${If} $VcRuntimeExitCode == 3010
        Delete "$PLUGINSDIR\${VC_RUNTIME_INSTALLER}"
        ${IfNot} ${Silent}
          MessageBox MB_ICONEXCLAMATION|MB_OK "Microsoft Visual C++ se instaló correctamente, pero Windows debe reiniciarse antes de instalar Elevate.$\r$\n$\r$\nReinicia el equipo y vuelve a ejecutar este instalador."
        ${EndIf}
        SetErrorLevel 3010
        Quit
      ${EndIf}

      ${If} $VcRuntimeExitCode == 0
      ${OrIf} $VcRuntimeExitCode == 1638
        Call IsRequiredVcRuntimeInstalled
        Pop $0
        ${If} $0 == "1"
          DetailPrint "Microsoft Visual C++ Redistributable x64 is ready."
          Delete "$PLUGINSDIR\${VC_RUNTIME_INSTALLER}"
          Goto ElevateVcRuntimeReady
        ${EndIf}
      ${EndIf}

      DetailPrint "Microsoft Visual C++ Redistributable x64 failed with code $VcRuntimeExitCode."
      ${If} ${Silent}
        Delete "$PLUGINSDIR\${VC_RUNTIME_INSTALLER}"
        ${If} $VcRuntimeExitCode == 0
          StrCpy $VcRuntimeExitCode 1
        ${EndIf}
        SetErrorLevel $VcRuntimeExitCode
        Quit
      ${EndIf}

      MessageBox MB_ICONSTOP|MB_RETRYCANCEL|MB_DEFBUTTON1 "Elevate necesita Microsoft Visual C++ Redistributable x64 para funcionar.$\r$\n$\r$\nLa instalación no se completó (código $VcRuntimeExitCode). Presiona Reintentar y acepta la solicitud de administrador, o Cancelar para cerrar el instalador.$\r$\n$\r$\nRegistro: $TEMP\Elevate-vc-redist.log" IDRETRY ElevateVcRuntimeInstall

      Delete "$PLUGINSDIR\${VC_RUNTIME_INSTALLER}"
      ${If} $VcRuntimeExitCode == 0
        StrCpy $VcRuntimeExitCode 1
      ${EndIf}
      SetErrorLevel $VcRuntimeExitCode
      Quit

    ElevateVcRuntimeReady:
  !macroend
!endif
