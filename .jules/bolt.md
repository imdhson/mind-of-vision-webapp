## 2024-10-05 - Avoid top-level fast-updating state in React Three Fiber Canvas
**Learning:** In a `@react-three/fiber` `Canvas`, subscribing to fast-updating state (like an object array updated at 14fps) at the top-level component that renders the `Canvas` causes the entire scene graph (including static elements like lights and grids) to be unnecessarily reconciled by React on every frame.
**Action:** Extract fast-updating state subscriptions into deeper child components (e.g., an `ObjectsLayer`) that only wrap the dynamic elements, allowing static elements to be mounted once and untouched. Also, ensure Zustand state setters don't trigger updates if the state hasn't actually changed (like continuous empty arrays).

## 2024-10-06 - Throttle fast-firing browser events linked to React state
**Learning:** Raw browser events like `deviceorientation` or `mousemove` can fire much faster than React can render. Binding these directly to state without throttling or quantization causes severe main thread blocking and frame drops, especially when driving context providers high in the tree (like `AppRuntime`).
**Action:** Always throttle/debounce fast-firing raw events (e.g. 100ms) and quantize values (e.g. round to 1 decimal place) before passing them to `setState` to allow React's bailout mechanisms to work.

## 2024-10-07 - Decouple heavy calculations from fast R3F frame loops
**Learning:** In `@react-three/fiber` applications, components often receive state updates at a slower frequency (e.g., a 14fps vision pipeline) but run `useFrame` callbacks at screen refresh rates (60Hz or higher). Performing array mappings or heavy math inside `useFrame` without memoization causes redundant work on identical data for multiple frames.
**Action:** Extract math and iterations that depend only on React props/state out of the `useFrame` callback, and memoize them using `useMemo`. This allows the 60fps interpolation loop to run cleanly while the heavy calculations only run when the underlying data changes.

## 2024-10-08 - Memoize heavy inner R3F elements in frequently updating groups
**Learning:** In `@react-three/fiber`, frequently updating a parent `<group>`'s position or rotation (e.g., from a tracker) can cause costly fiber prop diffing and object recreation for complex inner children (like Drei's `<Text>` or dynamic geometries) if they are re-evaluated on every render.
**Action:** Extract and memoize static or rarely-changing inner R3F elements using `useMemo`. Render the memoized content inside the frequently updating parent container to preserve high FPS and reduce GC pressure.

## 2024-10-09 - Use refs for continuously updating, non-reactive sensor data
**Learning:** Storing fast-updating sensor data (like device orientation/pitch) in React state triggers a re-render of the component tree every time the value changes, even if the value is only polled periodically by an external process (like a 14fps vision pipeline).
**Action:** Use `useRef` to store continuously updating data that does not need to instantly trigger a React render. The latest value can be accessed via `ref.current` by external consumers without paying the React rendering cost.

## 2024-10-10 - Hoist loop invariables in fast-running pipeline
**Learning:** In a fast-running vision pipeline loop (e.g., up to 14fps), creating anonymous objects and invoking function getters inside an array map for every detected object causes redundant heap allocations and function executions on identical state.
**Action:** Always hoist variables, context objects, and getter results that remain constant for a given frame execution outside of inner loops to minimize garbage collection pressure and CPU overhead.

## 2024-10-24 - Avoid Hidden DOM Reconciliation from Fast Data Stores
**Learning:** When using global stores (like Zustand) that update frequently (e.g., a vision pipeline updating 14fps), components listening to the store will re-render even if they are in an inactive/hidden tab. This causes unnecessary React reconciliation and DOM diffing, consuming CPU cycles on the main thread for elements the user can't see.
**Action:** Pass an `active` or `visible` prop to components that consume high-frequency store data. Within the component, use a conditional selector (e.g., returning a static empty array if inactive) so that the store updates bypass the component entirely when it is not active. This stops the reconciliation at the source.
## 2025-02-05 - Bypass React Three Fiber Reconciliation for Hidden Tabs
**Learning:** React Three Fiber components inside a hidden DOM element (e.g., inactive tab) continue to heavily execute reconciliation and waste CPU cycles when updating complex 3D meshes and Drei components driven by fast Zustand store updates (like a 14fps vision pipeline).
**Action:** Use a conditional Zustand selector that returns a static reference (e.g. `EMPTY_ARRAY`) when the component's visibility/tab is inactive. This completely bypasses the costly R3F reconciliation loop.

## 2026-10-13 - Replace O(N) array search with O(1) Map lookup
**Learning:** Found an O(N) array scan (`Array.find`) inside the fast-executing `resolve()` method within `CalibrationManager.ts` that is called for every tracked object 14 times per second. As calibration records increase, this causes a measurable CPU overhead inside the vision tracking pipeline.
**Action:** Changed the internal store to also maintain a Map (`recordsMap`) alongside the array. Updated the data access in `resolve()` to use O(1) `Map.get()` and synchronized the map across `init()`, `save()`, and `remove()`. Remember to avoid O(N) scans inside high-frequency processing paths by caching them into maps.

## 2024-10-14 - Prevent array allocation from Maps in high-frequency loops
**Learning:** In high-frequency execution paths (like a 14fps vision tracking pipeline), spreading a Map into an array (`[...map.values()]`) on every frame purely for iteration causes redundant heap allocations and creates measurable garbage collection pressure.
**Action:** Always iterate Maps directly using `for (const val of map.values())` instead of spreading them into arrays. If new items are added to the Map during iteration that should not be processed in subsequent loops, manage their state using a `Set` (e.g., a `used` set) rather than relying on a static Array snapshot.

## 2024-10-25 - Avoid spreading mapped arrays into Math functions
**Learning:** Found an instance of `Math.max(5, ...objects.map(...))` used inside a memoized block driven by fast-updating state. Even though `useMemo` avoids running it at 60fps, generating an intermediate array via `.map()` and spreading it onto the stack `...` creates redundant garbage collection pressure and has a maximum call stack size limit if the objects array were to theoretically get very large.
**Action:** Replace `...array.map()` patterns with a simple `for` loop, updating a local accumulator directly. This completely bypasses the intermediate array allocation and avoids spread syntax overhead.
