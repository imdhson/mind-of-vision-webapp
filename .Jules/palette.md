## 2023-10-04 - [Missing Focus and Disabled Styles]
**Learning:** [The app lacked visible focus indicators and visually distinct disabled states for standard form elements globally. Adding simple `:disabled` and `:focus-visible` to `globals.css` instantly improved accessibility across all tabs.]
**Action:** [Always ensure that base interactive elements (buttons, inputs, selects) have default focus and disabled styling in the global CSS before relying entirely on component-level styling.]

## 2023-10-04 - [Destructive Action Safety]
**Learning:** [The Saved Calibration Manager allowed instant deletion of calibration data without confirmation. Using native `window.confirm` provides an immediate, accessible, and zero-dependency safety net.]
**Action:** [Always wrap destructive actions in at least a native confirmation dialog if a custom UI component isn't readily available, and ensure destructive buttons have clear aria-labels describing what is being deleted.]

## 2023-10-05 - Escape Key Dismissal for Floating Sheets
**Learning:** Floating sheets/modals over immersive scenes (3D/Camera) need quick keyboard dismissal (Escape key). Users get frustrated when forced to click a small "close" button, especially when interacting with rapid live object data.
**Action:** Always add a global Escape key listener to dismiss temporary overlays/sheets (`role="dialog"`), and update the close button with `aria-label` and `title` to hint at the keyboard shortcut.

## 2026-10-06 - Empty State CTAs & Alert Accessibility
**Learning:** Absolute-positioned error banners and empty states often fail to register with screen readers unless explicit ARIA attributes are used. Additionally, placing primary actions inside central empty state areas improves discoverability compared to small toolbar buttons.
**Action:** Always add `role="alert"` and `aria-live="assertive"` to error banners, and embed actionable CTAs within `.empty-state` overlays to guide the user naturally.
## 2024-10-07 - Accessible Custom Segments and Status Messages
**Learning:** Custom segmented controls built with divs and buttons lack inherent structure for screen readers, meaning users can't identify the group context or their selected state. Status/error messages that appear dynamically (like calibration success) are visually clear but silently ignored by assistive technologies without ARIA live regions.
**Action:** Always wrap custom segmented controls in `role="group"` with an `aria-label`, use `aria-pressed` on the individual buttons to denote active states, and ensure any dynamically rendered success/error text has `role="status" aria-live="polite"` so it is properly announced.

## 2023-10-25 - Async Button UI States and A11y Forms
**Learning:** React components dealing with IndexedDB (like the calibration saves) can take non-trivial time, so providing visual loading states on standard buttons with the disabled and aria-busy attributes improves confidence. Additionally, while the app visually associates spans inside labels, screen readers still need explicit `htmlFor` and `id` linking, particularly inside `.form-grid` layouts.
**Action:** Always include loading states for any async IndexedDB interactions, disable buttons to prevent multi-clicks, and explicitly link labels to form inputs via `htmlFor` and `id`, even if wrapped in a semantic `<label>` container.

## 2026-10-09 - [Background Task Status and ARIA Live]
**Learning:** [Users relying on assistive technology are unaware when background operations (like ML model loading) change states unless explicitly announced. Disabling inputs without context causes confusion.]
**Action:** [Always use `role="status"` and `aria-live="polite"` on descriptive text elements associated with background operations, and ensure states map to human-readable (localized) text rather than raw developer strings.]
## 2026-10-10 - Dialog Focus Management
**Learning:** Opening a floating sheet/dialog without programmatically shifting focus strands keyboard and screen-reader users, breaking accessibility.
**Action:** Always save `document.activeElement` when opening a sheet, move focus to the sheet's wrapper (`tabIndex={-1}`), and restore focus to the original trigger when closed.
