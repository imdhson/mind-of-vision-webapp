## 2023-10-04 - [Missing Focus and Disabled Styles]
**Learning:** [The app lacked visible focus indicators and visually distinct disabled states for standard form elements globally. Adding simple `:disabled` and `:focus-visible` to `globals.css` instantly improved accessibility across all tabs.]
**Action:** [Always ensure that base interactive elements (buttons, inputs, selects) have default focus and disabled styling in the global CSS before relying entirely on component-level styling.]

## 2023-10-04 - [Destructive Action Safety]
**Learning:** [The Saved Calibration Manager allowed instant deletion of calibration data without confirmation. Using native `window.confirm` provides an immediate, accessible, and zero-dependency safety net.]
**Action:** [Always wrap destructive actions in at least a native confirmation dialog if a custom UI component isn't readily available, and ensure destructive buttons have clear aria-labels describing what is being deleted.]

## 2023-10-05 - Escape Key Dismissal for Floating Sheets
**Learning:** Floating sheets/modals over immersive scenes (3D/Camera) need quick keyboard dismissal (Escape key). Users get frustrated when forced to click a small "close" button, especially when interacting with rapid live object data.
**Action:** Always add a global Escape key listener to dismiss temporary overlays/sheets (`role="dialog"`), and update the close button with `aria-label` and `title` to hint at the keyboard shortcut.
