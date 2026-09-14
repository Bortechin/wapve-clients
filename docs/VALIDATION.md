# Initial publication validation

Preparation date: 2026-09-14. These results describe the source snapshot being
published; they are not a promise that every platform or live-service flow works
for every contributor.

Passed:

- `pnpm install --frozen-lockfile` with Node.js 24.19.0 and pnpm 10.34.5.
- `pnpm build`: client packages, Next.js production build, Electron UI and
  Electron main process build completed.
- `pnpm test`: desktop smoke 9 passed; API client 6 passed; contracts 93 passed;
  web 111 passed; mobile 50 passed.
- `pnpm --filter @wapve/web test:e2e:smoke` in its supported development-server
  mode: 12 tests passed across desktop and mobile Chromium. A standalone
  `next start` smoke attempt was discarded because Next's proxy rewrite loop on
  the loopback production server is not the supported test mode.
- `pnpm --filter @wapve/web lint` and `pnpm --filter @wapve/mobile lint` after
  publication-only lint compatibility fixes.
- `pnpm --filter @wapve/web typecheck` and `pnpm --filter @wapve/mobile typecheck`.
- Android debug Gradle build was attempted with JDK 21 and the local Android
  SDK. It reached native compilation but failed after 18 minutes because the
  React Native Worklets CMake/Ninja object path remained over Windows' path
  limit, even after the short pnpm virtual-store preparation. No APK is claimed.
- Electron capture smoke: 2 visible sources and offline fallback fixture.
- Gitleaks v8.30.1 scan of all tracked publication files: no leaks found.
- `pnpm release:check`: publication boundary passed for the tracked snapshot.

Not covered:

- No live login, messaging, voice/video, push notification, or multi-device
  acceptance against the hosted Wapve service.
- No physical Android device, microphone, camera, screen-share, TalkBack or
  large-text acceptance.
- No production Android signing or Firebase configuration; those remain private.
- No Windows installer distribution or signed production artifact in this source
  release. Third-party binary redistribution still needs an artifact-specific
  notice/license review.
