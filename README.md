# Wapve Clients

Web, Windows desktop and Android clients for [Wapve](https://wapve.com), a
community communication platform with messaging, voice, video and shared spaces.

**Source-available • Noncommercial source license • Contributions welcome**

[Türkçe](README.tr.md) · [License](LICENSE) · [Contributing](CONTRIBUTING.md) ·
[Security](SECURITY.md) · [Build verification](docs/VALIDATION.md)

## What is published

| Directory | Purpose |
| --- | --- |
| `apps/web` | Next.js web client and public website |
| `apps/desktop` | Electron Windows shell, capture picker and native integration |
| `apps/mobile` | Expo / React Native Android client and native modules |
| `packages` | Client API bindings, realtime bindings, shared schemas, UI and configuration |

The backend, database, deployment infrastructure, operational documents and
official signing keys are not included. This repository starts with a clean
client-only history. The hosted Wapve service continues to operate separately;
publishing this repository does not change existing accounts or installed clients.

The desktop application loads the hosted web client by default. This is not an
offline app or a full self-hostable Wapve server. Shared API schemas describe the
client protocol and do not contain the backend implementation.

## License and commercial use

The original code uses **PolyForm Noncommercial 1.0.0**, with a separate additional
permission for official-client use and contributing. Companies may use official
Wapve clients for business communication. Reviewing, testing and contributing to
Wapve is also permitted for companies under that additional grant.

Using this code to build a separately monetized application or service requires
separate written permission unless an existing license grant authorizes the use.
This is **source-available, not OSI-approved open source**. Read the controlling
[LICENSE](LICENSE), [additional permission](licenses/OFFICIAL-CLIENT-PERMISSION.md)
and [artwork/brand policy](TRADEMARKS.md). Third-party code keeps its own licenses.

## Prerequisites

- Node.js **24.19.0** (the supported range is `>=24.19.0 <25`).
- pnpm **10.34.5** (`npm install --global pnpm@10.34.5`).
- Git. Android builds also need JDK 21 and an Android SDK/NDK matching the Gradle
  configuration. Windows desktop packaging requires Windows.

```sh
git clone https://github.com/Bortechin/wapve-clients.git
cd wapve-clients
pnpm install --frozen-lockfile
pnpm --filter './packages/*' build
```

On Windows, `wapve.cmd` is an optional pnpm wrapper. Node and pnpm must already be
installed; the repository does not include a private portable runtime.

## Web development

Copy `apps/web/.env.example` to `apps/web/.env.local`, then run:

```sh
pnpm --filter @wapve/web dev
```

Open http://localhost:3000. Public pages and local unit tests can be developed
without the backend. Login, messages, calls, account data and other connected
features require a compatible, authorized API and realtime endpoint.

`API_INTERNAL_URL` is for server-side requests; `NEXT_PUBLIC_API_URL` and
`NEXT_PUBLIC_SOCKET_URL` configure browser requests. They are not secret values.
Do not assume that changing these to the live service makes a local browser build
work: CORS, cookies, CSP, allowed origins, anti-abuse and service access policies
still apply. This publication does not weaken those protections or promise
unrestricted third-party client access. Use official Wapve for normal service use.

## Windows desktop

```sh
pnpm --filter @wapve/desktop dev
pnpm --filter @wapve/desktop check
pnpm --filter @wapve/desktop dist:win
```

The shell loads https://wapve.com/desktop by default. For an unpackaged development
session, set `WAPVE_DESKTOP_URL` to a local web URL accepted by the client URL
policy. Packaging output appears under `apps/desktop/release`. Locally built
packages are unofficial and are not signed with Wapve's production credentials.
Follow TRADEMARKS.md before distributing them. The included Electron smoke test
uses a local fixture; it does not validate a live account or physical microphone.

## Android development

Use an emulator or a device you control. Copy `apps/mobile/.env.example` to
`apps/mobile/.env` and configure an authorized development API. `10.0.2.2` reaches
the host from the standard Android emulator; a device needs a reachable host URL.

On Windows, set `JAVA_HOME` to JDK 21 and `ANDROID_HOME` to the Android SDK, then:

```sh
pnpm --filter @wapve/mobile build:debug
pnpm --filter @wapve/mobile start
```

The build script uses the checked-in native Android project and creates a local,
ignored debug key if needed. Install the generated debug APK from
`apps/mobile/android/app/build/outputs/apk/debug`. Expo Go is insufficient because
the client uses custom native modules. `pnpm --filter @wapve/mobile android` uses
Expo's native run workflow; native changes should be reviewed after prebuild.

For other systems, use JDK 21, your Android SDK and the checked-in Gradle wrapper;
create a local Android debug keystore before `./gradlew assembleDebug`. Windows
native builds may need a short checkout and pnpm virtual-store path due to CMake
path limits; never share a virtual store with another working checkout.

Release builds require your own `WAPVE_RELEASE_STORE_FILE`,
`WAPVE_RELEASE_STORE_PASSWORD`, `WAPVE_RELEASE_KEY_ALIAS` and
`WAPVE_RELEASE_KEY_PASSWORD`. Never commit these values or keys. Firebase push
needs your own configuration and matching service integration; Wapve production
Firebase configuration and signing keys are not published. iOS is not a supported
release target of this snapshot.

## Checks

```sh
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm test:e2e
pnpm release:check
```

`test:e2e` runs the public-page smoke suite. Backend integration tests and their
private fixtures are not included. `release:check` validates the Git-tracked
publication boundary; use Gitleaks separately to scan secrets. See
[docs/VALIDATION.md](docs/VALIDATION.md) for actual results and limitations.

For bugs and ideas, open an issue. For vulnerabilities, use [SECURITY.md](SECURITY.md).
For contributions, read [CONTRIBUTING.md](CONTRIBUTING.md), including its licensing
terms, before opening a pull request.
