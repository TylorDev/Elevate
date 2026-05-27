!macro customInstall
  DetailPrint "Installing Microsoft Visual C++ Redistributable x64..."

  IfFileExists "$INSTDIR\resources\redist\vc_redist.x64.exe" 0 vcRedistMissing
    ExecWait '"$INSTDIR\resources\redist\vc_redist.x64.exe" /install /quiet /norestart' $0

    ${If} $0 == 0
      DetailPrint "Microsoft Visual C++ Redistributable x64 installed."
    ${ElseIf} $0 == 1638
      DetailPrint "Microsoft Visual C++ Redistributable x64 is already installed."
    ${ElseIf} $0 == 3010
      DetailPrint "Microsoft Visual C++ Redistributable x64 installed; reboot may be required."
    ${Else}
      DetailPrint "Microsoft Visual C++ Redistributable x64 installer exited with code $0."
    ${EndIf}
    Goto vcRedistDone

  vcRedistMissing:
    DetailPrint "Microsoft Visual C++ Redistributable x64 installer was not bundled."

  vcRedistDone:
!macroend
