## 2023-10-04 - [Missing Focus and Disabled Styles]
**Learning:** [The app lacked visible focus indicators and visually distinct disabled states for standard form elements globally. Adding simple `:disabled` and `:focus-visible` to `globals.css` instantly improved accessibility across all tabs.]
**Action:** [Always ensure that base interactive elements (buttons, inputs, selects) have default focus and disabled styling in the global CSS before relying entirely on component-level styling.]

## 2023-10-04 - [Destructive Action Safety]
**Learning:** [The Saved Calibration Manager allowed instant deletion of calibration data without confirmation. Using native `window.confirm` provides an immediate, accessible, and zero-dependency safety net.]
**Action:** [Always wrap destructive actions in at least a native confirmation dialog if a custom UI component isn't readily available, and ensure destructive buttons have clear aria-labels describing what is being deleted.]
