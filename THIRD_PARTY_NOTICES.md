# Third-party software and assets

Wapve's source license applies only to material its rights holders can license.
Third-party works retain their original permissions and obligations. In
particular, the commercial-use restriction on Wapve's original code does not
relicense independently reusable MIT, Apache, BSD, MPL or other third-party code.

## JavaScript dependencies

[licenses/dependencies.json](licenses/dependencies.json) records installed package
names, versions, declared licenses, repository references and included notice
files for the initial source release. [licenses/third-party](licenses/third-party)
preserves license/copyright/notice files supplied by those installed packages.
The lockfile, rather than the inventory, controls dependency resolution.

This is an inventory from the Windows preparation environment, not a claim that
every optional binary on every platform is present. Some packages do not ship a
standalone license file; consult the package's upstream repository and release
archive for its complete terms. Regenerate and review notices when dependencies
change. npm dependencies themselves are installed separately, not vendored here.

MPL-covered dependencies remain MPL-covered; no modifications to their files are
claimed under Wapve's license. `node-forge` offers a BSD-3-Clause alternative.
Sharp's optional native packages include libvips under LGPL terms; distributors
of binary products must satisfy the relevant native-component obligations.
No native release binaries are distributed in this initial source snapshot.

## Adapted and patched source

- The mobile Reacticx shimmer adaptation retains the MIT notice in
  [apps/mobile/THIRD_PARTY_NOTICES.md](apps/mobile/THIRD_PARTY_NOTICES.md).
- The `query-string` dependency is patched by
  [patches/query-string@7.1.3.patch](patches/query-string@7.1.3.patch).
  The upstream package is MIT licensed; its license is retained in the inventory.
- The Android Gradle wrapper is Gradle tooling under Apache-2.0; see
  https://github.com/gradle/gradle/blob/master/LICENSE. Android/Expo/React Native
  generated scaffolding retains its upstream terms where applicable.

## Audio, icons and visual assets

The web audio preparation script copies worklet/WASM assets from
`@sapphi-red/web-noise-suppressor`. Its package and underlying component notices
remain applicable to any redistributed build. Review the upstream package's
full notices before shipping modified audio binaries.

Lucide, Expo vector icons, CLDR data and other installed UI assets retain their
package licenses. Wapve-owned branding and premium assets have the separate
permissions in [TRADEMARKS.md](TRADEMARKS.md). Public game-icon placeholders are
generic vectors; referenced game names remain the property of their owners.

## Distribution responsibility

Building an installer, APK, AAB or deployed web bundle may include additional
runtime and native libraries, including Electron/Chromium, React Native, WebRTC,
Android components and noise-processing code. Preserve their bundled licenses,
attribution and any applicable source/relinking rights when distributing them.
This source inventory does not replace a per-artifact distribution review.
