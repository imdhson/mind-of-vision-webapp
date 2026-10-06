## 2024-10-05 - Avoid top-level fast-updating state in React Three Fiber Canvas
**Learning:** In a `@react-three/fiber` `Canvas`, subscribing to fast-updating state (like an object array updated at 14fps) at the top-level component that renders the `Canvas` causes the entire scene graph (including static elements like lights and grids) to be unnecessarily reconciled by React on every frame.
**Action:** Extract fast-updating state subscriptions into deeper child components (e.g., an `ObjectsLayer`) that only wrap the dynamic elements, allowing static elements to be mounted once and untouched. Also, ensure Zustand state setters don't trigger updates if the state hasn't actually changed (like continuous empty arrays).

## 2024-10-06 - Throttle fast-firing browser events linked to React state
**Learning:** Raw browser events like `deviceorientation` or `mousemove` can fire much faster than React can render. Binding these directly to state without throttling or quantization causes severe main thread blocking and frame drops, especially when driving context providers high in the tree (like `AppRuntime`).
**Action:** Always throttle/debounce fast-firing raw events (e.g. 100ms) and quantize values (e.g. round to 1 decimal place) before passing them to `setState` to allow React's bailout mechanisms to work.
