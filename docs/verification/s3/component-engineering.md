# S3 NativeRenderer component verification

Worktree: `/Users/observedobserver/.codex/worktrees/native-worksheet-s3-results/graphic-walker`.

## Passed checks

- Six pure helper tests in `packages/worksheet-renderer/tests/native-display.test.ts` pass. They cover static theme projection and diagnostics, typed member order, empty collapsed parents, fixed domain preservation and conflicting sort rejection, chart-list readiness cleanup, structured selection values/endpoints, stale export rejection and cancellation.
- Six browser cases in `packages/graphic-walker/tests/e2e/native-renderer.spec.ts` pass on Chromium, Firefox and WebKit against production build 3 on port 4186: **18/18**, 10.5 seconds.
- Real React development StrictMode on a separate Vite development server at port 4187 passed the first five cases together and the sixth header case separately. This run exercises development effect replay. Production StrictMode does not replay effects and is not presented as that evidence.

Production command, from `packages/graphic-walker`:

```sh
GW_E2E_PORT=4186 yarn playwright test tests/e2e/native-renderer.spec.ts
```

Development command uses `GW_E2E_PORT=4187` with the same spec and `--project=chromium`, after starting `yarn vite --config tests/e2e/vite.config.ts --host 127.0.0.1 --port 4187 --strictPort`. The development server was stopped after verification.

## Browser coverage

1. One bounded worksheet controller; SVG/PNG getters and download methods return a single complete viewport; AppRoot export metadata is native 1×1; chart-list export resolves.
2. Backend, dark theme and color range changes retain the controller, scroll offset and prepared presentation identity. The latest color range reaches the plan.
3. Pending and failed query snapshots block all four legacy exports and interaction; a new successful snapshot recovers.
4. A real pointer click has current coordinates and original field/config/value data. Keyboard selection and brush selection do not inherit click coordinates.
5. Unmount removes the controller and preserves handlers installed by another owner. Remount creates one controller.
6. Keyboard header collapse and sort commit new presentations. Missing parent records remain empty; expanding restores the child view.

## Defects found and fixed

- A microtask cleared the React click-capture token before the worksheet's native bubbling click listener. The token is now consumed once by selection and otherwise cleared at the end of the click task; timers are released on unmount.
- During development StrictMode, the child export bridge read AppRoot's ref before the parent's layout effect published its handle. The local export API keeps its independent mount lifetime, while AppRoot registration happens in a passive effect after the parent handle exists.
- Theme memoization omitted encoding and aggregation inputs read by the theme mapper. Those dependencies are now explicit.
- A cached prepared scale map could retain a stale color range. Preparation now retains only calculated display sort domains; the current adapted scales supply cosmetic ranges.
- Failed or superseded display preparation now rejects its pending controlled request explicitly.

An initial production Chromium scroll test observed the DOM scroll offset before the native scroll event was processed and switched backend immediately. The test now waits for the real scroll event and two animation frames. Its focused case passed five consecutive runs, followed by the full 18/18 run. No renderer change was made for this test timing issue.

These are implementation regression checks. They do not replace the independent code review, full Graphic Walker integration tests, or independent visual acceptance.

## Verification after export-handle retention fix

The independent reviewer found that retaining an old forwarded export handle could also retain the result snapshot through the hook's latest-target closure. The root implementation changed the module-level handle factory to capture only the API ref, clears the factory target on disposal, and releases the hook's target after unmount while allowing immediate StrictMode setup replay.

After that change, all six component cases were rerun together against the current source with the React development server on port 4187: **6/6 passed**, 2.5 seconds. This includes real StrictMode effect replay, all four export methods, AppRoot and list exports, stale-result rejection, and export-handler ownership across unmount/remount. No product code was changed during this verification, and the development server was stopped afterward.

```sh
GW_E2E_PORT=4187 yarn playwright test tests/e2e/native-renderer.spec.ts --project=chromium
```

This is a functional lifecycle regression check. The independent reviewer's separate V8 WeakRef/GC probe verifies that the old result can be collected; this browser run does not establish GC behavior. The earlier production 18/18 result used build 3 before this retention fix and is not a post-fix production result.
