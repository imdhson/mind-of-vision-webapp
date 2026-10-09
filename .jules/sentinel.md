## 2024-05-18 - Information Disclosure via UI Error Messages
**Vulnerability:** Raw error messages (`e.message` and `String(e)`) from internal functions were being passed directly to state and rendered in the UI (e.g., CameraTab, SettingsTab, CalibrationPanel).
**Learning:** This exposes implementation details, potential stack traces, or internal logic to the end user, which violates the "fail securely" principle and creates an information disclosure risk.
**Prevention:** Always log the original raw error to `console.error` for debugging, but set generic, safe strings in UI-facing state variables.

## 2024-05-18 - Missing Content Security Policy (CSP)
**Vulnerability:** The `index.html` lacked a `<meta http-equiv="Content-Security-Policy">` tag.
**Learning:** Without a CSP, the application is more susceptible to Cross-Site Scripting (XSS) attacks, as any script or resource could theoretically be loaded and executed.
**Prevention:** Implement a strict default CSP (e.g., `default-src 'self'`) and explicitly whitelist necessary external domains (like `https://storage.googleapis.com` for TFJS models) and allowed inline behaviors (`'unsafe-inline'` for React/Vite styles if necessary).

## 2026-10-09 - Information Disclosure via Console Logs
**Vulnerability:** Raw error objects (`e`) were being logged directly to `console.error` in catch blocks.
**Learning:** Directly logging raw error objects can expose full stack traces and sensitive internal execution details to the browser console. This violates the "fail securely" principle.
**Prevention:** When logging errors in catch blocks, extract and log only the relevant safe information, such as `e.message` if it is an `Error` object, to prevent leaking stack traces or internal mechanics.
