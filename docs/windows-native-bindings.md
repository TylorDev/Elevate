# Windows native bindings

Elevate ships native Node addons in the Electron package. The most important
startup path is:

`@prisma/adapter-libsql -> @libsql/client -> libsql -> @libsql/win32-x64-msvc/index.node`

On clean Windows machines, an error such as `No se puede encontrar el modulo
especificado` can appear even when `index.node` exists. In that case Windows is
usually failing to load a dependent DLL, most commonly the Microsoft Visual C++
Redistributable x64 runtime required by MSVC-built native modules.

The Windows installer bundles the latest supported Microsoft Visual C++ v14
Redistributable x64 from Microsoft's official permalink:

`https://aka.ms/vc14/vc_redist.x64.exe`

Packaging expectations:

- Native `.node` files must be unpacked outside `app.asar`.
- `@libsql`, `libsql`, `sharp`, and the platform-specific `@img/sharp-*`
  packages must stay available in `app.asar.unpacked`.
- `build:win` prepares `build/redist/vc_redist.x64.exe`; the binary is ignored
  by git and can also be supplied with `VC_REDIST_X64_PATH` for offline builds.
- NSIS runs the redist silently with `/install /quiet /norestart`; exit codes
  `0`, `1638`, and `3010` are treated as non-fatal.
- `sass` is build-time only and should remain in `devDependencies` so
  `@parcel/watcher` is not included as a production runtime dependency.

Runtime diagnostics are logged by the Electron main process under the
`[native diagnostics]` prefix. If `libsql` fails to load and the `.node` file is
present, check the logged `nativeImports.dlls` list for runtime DLLs such as
`VCRUNTIME140.dll` and `api-ms-win-crt-*`.
