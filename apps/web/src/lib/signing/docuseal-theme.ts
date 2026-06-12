/**
 * Proxy brand theme for the embedded DocuSeal signing form.
 *
 * Injected via the DocusealForm `customCss` prop. DocuSeal renders inside a
 * shadow root, so these selectors target its internal markup (mapped from the
 * live form DOM). Icon swaps key off the field's aria-label (the field NAME,
 * not type) — unmatched fields gracefully fall back to a clean tinted box.
 */

type ThemeColors = {
  pageBg: string;
  cardBg: string;
  cardBorder: string;
  inputBg: string;
  inputBorder: string;
  textPrimary: string;
  textSecondary: string;
  brand: string;
  brandLight: string;
};

const LIGHT: ThemeColors = {
  pageBg: "#f8f7f6",
  cardBg: "#ffffff",
  cardBorder: "#e2dfdc",
  inputBg: "#ffffff",
  inputBorder: "#e2dfdc",
  textPrimary: "#1a1a1a",
  textSecondary: "#6b7280",
  brand: "#1b77be",
  brandLight: "#02aaeb",
};

const DARK: ThemeColors = {
  pageBg: "#1a1a1a",
  cardBg: "#141414",
  cardBorder: "#3a3a3a",
  inputBg: "#222222",
  inputBorder: "#3a3a3a",
  textPrimary: "#ececec",
  textSecondary: "#a0a0a0",
  brand: "#1b77be",
  brandLight: "#02aaeb",
};

function buildCss(c: ThemeColors): string {
  return `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Geist:wght@400;500;600;700&display=swap');

/* Base */
body, .form-container, .modal-box, input, button, select, textarea {
  font-family: 'Geist', ui-sans-serif, system-ui, sans-serif !important;
}
body, #scrollbox { background-color: ${c.pageBg} !important; }

/* Form card: compact floating card, not a full-width sheet */
.form-container, #form_container {
  background: ${c.cardBg} !important;
  border: 1px solid ${c.cardBorder} !important;
  border-radius: 16px !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05), 0 12px 36px rgba(0,0,0,0.10) !important;
  max-width: 440px !important;
  left: 0 !important;
  right: 0 !important;
  margin-left: auto !important;
  margin-right: auto !important;
  bottom: 16px !important;
}
#form_container { padding: 18px 20px 10px !important; }

/* Compact type scale inside the card */
.field-name-label {
  font-size: 16px !important;
  line-height: 1.3 !important;
}

/* Field labels */
.label, .field-name-label {
  font-family: 'Sora', sans-serif !important;
  font-weight: 600 !important;
  letter-spacing: -0.01em !important;
  color: ${c.textPrimary} !important;
}

/* Inputs */
.base-input {
  border: 1.5px solid ${c.inputBorder} !important;
  border-radius: 10px !important;
  min-height: 0 !important;
  height: 42px !important;
  font-size: 15px !important;
  padding-top: 8px !important;
  padding-bottom: 8px !important;
  background: ${c.inputBg} !important;
  color: ${c.textPrimary} !important;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04) !important;
  transition: border-color 150ms ease, box-shadow 150ms ease !important;
}
.base-input:focus {
  border-color: ${c.brand} !important;
  box-shadow: 0 0 0 3px rgba(2,170,235,0.18) !important;
  outline: none !important;
}
.base-input::placeholder { color: ${c.textSecondary} !important; }

/* Primary buttons */
.base-button, .submit-form-button, #submit_form_button {
  background: linear-gradient(135deg, ${c.brandLight}, ${c.brand}) !important;
  border: none !important;
  border-radius: 12px !important;
  color: #ffffff !important;
  font-weight: 600 !important;
  letter-spacing: 0.01em !important;
  text-transform: none !important;
  font-size: 14px !important;
  min-height: 0 !important;
  height: 40px !important;
  box-shadow: 0 2px 8px rgba(27,119,190,0.28), 0 1px 2px rgba(0,0,0,0.06) !important;
  transition: opacity 150ms ease, transform 150ms cubic-bezier(0.16,1,0.3,1) !important;
}
.base-button:hover, .submit-form-button:hover, #submit_form_button:hover {
  opacity: 0.92 !important;
  transform: translateY(-1px) !important;
}
.base-button:active, .submit-form-button:active, #submit_form_button:active {
  transform: translateY(0) !important;
}

/* Secondary / neutral buttons */
.btn-neutral, #decline_button, #decline_button_mobile {
  background: ${c.cardBg} !important;
  border: 1px solid ${c.cardBorder} !important;
  border-radius: 12px !important;
  color: ${c.textSecondary} !important;
  font-weight: 500 !important;
  text-transform: none !important;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04) !important;
}
.btn-neutral:hover, #decline_button:hover { color: ${c.textPrimary} !important; }

/* Field overlays on the document (PDF stays light in both themes) */
.field-area {
  background-color: rgba(2,170,235,0.08) !important;
  outline-color: rgba(27,119,190,0.45) !important;
  border-radius: 4px !important;
}
.field-area.border { border-color: rgba(27,119,190,0.35) !important; }
.field-area-active { outline-color: ${c.brand} !important; }
.field-area-active-label {
  background: ${c.brand} !important;
  color: #ffffff !important;
  border-radius: 6px !important;
  font-weight: 600 !important;
}

/* Icons: hide stock placeholder glyphs, then re-draw per field via mask */
.field-area span.opacity-50 svg { display: none !important; }
.field-area span.opacity-50 { opacity: 1 !important; }
.field-area[aria-label*="signature" i] span.opacity-50::after {
  content: "" !important;
  display: block !important;
  width: 44px !important;
  height: 44px !important;
  background: linear-gradient(135deg, ${c.brandLight}, ${c.brand}) !important;
  -webkit-mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cline x1='24' y1='176' x2='232' y2='176' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cpath d='M24,224S139.52,32,77.91,32C32.07,32,31.58,225.11,128,104.19c0,0,8.11,39.44,27.23,39.81,7.72.15,17.25-6.31,28.77-24,0,0,0,24,48,24' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3C/svg%3E") center / contain no-repeat !important;
  mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cline x1='24' y1='176' x2='232' y2='176' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cpath d='M24,224S139.52,32,77.91,32C32.07,32,31.58,225.11,128,104.19c0,0,8.11,39.44,27.23,39.81,7.72.15,17.25-6.31,28.77-24,0,0,0,24,48,24' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3C/svg%3E") center / contain no-repeat !important;
}
.field-area[aria-label*="initial" i] span.opacity-50::after {
  content: "" !important;
  display: block !important;
  width: 28px !important;
  height: 28px !important;
  background: linear-gradient(135deg, ${c.brandLight}, ${c.brand}) !important;
  -webkit-mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Ccircle cx='124' cy='132' r='20' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cline x1='40.01' y1='216' x2='109.86' y2='146.14' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cpath d='M40,216l139.45-23.24a8,8,0,0,0,6.17-5.08L208,128,128,48,68.32,70.38a8,8,0,0,0-5.08,6.17Z' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cpath d='M208,128l29.66-29.66a8,8,0,0,0,0-11.31L169,18.34a8,8,0,0,0-11.31,0L128,48' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3C/svg%3E") center / contain no-repeat !important;
  mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Ccircle cx='124' cy='132' r='20' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cline x1='40.01' y1='216' x2='109.86' y2='146.14' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cpath d='M40,216l139.45-23.24a8,8,0,0,0,6.17-5.08L208,128,128,48,68.32,70.38a8,8,0,0,0-5.08,6.17Z' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cpath d='M208,128l29.66-29.66a8,8,0,0,0,0-11.31L169,18.34a8,8,0,0,0-11.31,0L128,48' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3C/svg%3E") center / contain no-repeat !important;
}
.field-area[aria-label*="date" i] span.opacity-50::after {
  content: "" !important;
  display: block !important;
  width: 20px !important;
  height: 20px !important;
  background: ${c.brand} !important;
  -webkit-mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Crect x='40' y='40' width='176' height='176' rx='8' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cline x1='176' y1='24' x2='176' y2='56' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cline x1='80' y1='24' x2='80' y2='56' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cline x1='40' y1='88' x2='216' y2='88' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3C/svg%3E") center / contain no-repeat !important;
  mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Crect x='40' y='40' width='176' height='176' rx='8' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cline x1='176' y1='24' x2='176' y2='56' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cline x1='80' y1='24' x2='80' y2='56' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cline x1='40' y1='88' x2='216' y2='88' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3C/svg%3E") center / contain no-repeat !important;
}
.field-area[aria-label*="number" i] span.opacity-50::after {
  content: "" !important;
  display: block !important;
  width: 20px !important;
  height: 20px !important;
  background: ${c.brand} !important;
  -webkit-mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cline x1='48' y1='96' x2='224' y2='96' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cline x1='176' y1='40' x2='144' y2='216' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cline x1='112' y1='40' x2='80' y2='216' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cline x1='32' y1='160' x2='208' y2='160' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3C/svg%3E") center / contain no-repeat !important;
  mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cline x1='48' y1='96' x2='224' y2='96' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cline x1='176' y1='40' x2='144' y2='216' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cline x1='112' y1='40' x2='80' y2='216' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cline x1='32' y1='160' x2='208' y2='160' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3C/svg%3E") center / contain no-repeat !important;
}
.field-area[aria-label*="phone" i] span.opacity-50::after {
  content: "" !important;
  display: block !important;
  width: 20px !important;
  height: 20px !important;
  background: ${c.brand} !important;
  -webkit-mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cpath d='M164.39,145.34a8,8,0,0,1,7.59-.69l47.16,21.13a8,8,0,0,1,4.8,8.3A48.33,48.33,0,0,1,176,216,136,136,0,0,1,40,80,48.33,48.33,0,0,1,81.92,32.06a8,8,0,0,1,8.3,4.8l21.13,47.2a8,8,0,0,1-.66,7.53L89.32,117a7.93,7.93,0,0,0-.54,7.81c8.27,16.93,25.77,34.22,42.75,42.41a7.92,7.92,0,0,0,7.83-.59Z' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3C/svg%3E") center / contain no-repeat !important;
  mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cpath d='M164.39,145.34a8,8,0,0,1,7.59-.69l47.16,21.13a8,8,0,0,1,4.8,8.3A48.33,48.33,0,0,1,176,216,136,136,0,0,1,40,80,48.33,48.33,0,0,1,81.92,32.06a8,8,0,0,1,8.3,4.8l21.13,47.2a8,8,0,0,1-.66,7.53L89.32,117a7.93,7.93,0,0,0-.54,7.81c8.27,16.93,25.77,34.22,42.75,42.41a7.92,7.92,0,0,0,7.83-.59Z' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3C/svg%3E") center / contain no-repeat !important;
}
.field-area[aria-label*="email" i] span.opacity-50::after {
  content: "" !important;
  display: block !important;
  width: 20px !important;
  height: 20px !important;
  background: ${c.brand} !important;
  -webkit-mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cpath d='M32,56H224a0,0,0,0,1,0,0V192a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V56A0,0,0,0,1,32,56Z' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cpolyline points='224 56 128 144 32 56' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3C/svg%3E") center / contain no-repeat !important;
  mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cpath d='M32,56H224a0,0,0,0,1,0,0V192a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V56A0,0,0,0,1,32,56Z' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cpolyline points='224 56 128 144 32 56' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3C/svg%3E") center / contain no-repeat !important;
}
.field-area[aria-label*="check" i] span.opacity-50::after {
  content: "" !important;
  display: block !important;
  width: 20px !important;
  height: 20px !important;
  background: ${c.brand} !important;
  -webkit-mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cpolyline points='88 136 112 160 168 104' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Crect x='40' y='40' width='176' height='176' rx='8' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3C/svg%3E") center / contain no-repeat !important;
  mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cpolyline points='88 136 112 160 168 104' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Crect x='40' y='40' width='176' height='176' rx='8' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3C/svg%3E") center / contain no-repeat !important;
}
.field-area[aria-label*="image" i] span.opacity-50::after {
  content: "" !important;
  display: block !important;
  width: 24px !important;
  height: 24px !important;
  background: ${c.brand} !important;
  -webkit-mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Crect x='40' y='40' width='176' height='176' rx='8' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Ccircle cx='96' cy='96' r='16' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cpath d='M56.69,216,166.34,106.34a8,8,0,0,1,11.32,0L216,144.69' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3C/svg%3E") center / contain no-repeat !important;
  mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Crect x='40' y='40' width='176' height='176' rx='8' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Ccircle cx='96' cy='96' r='16' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cpath d='M56.69,216,166.34,106.34a8,8,0,0,1,11.32,0L216,144.69' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3C/svg%3E") center / contain no-repeat !important;
}
.field-area[aria-label*="photo" i] span.opacity-50::after {
  content: "" !important;
  display: block !important;
  width: 24px !important;
  height: 24px !important;
  background: ${c.brand} !important;
  -webkit-mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Crect x='40' y='40' width='176' height='176' rx='8' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Ccircle cx='96' cy='96' r='16' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cpath d='M56.69,216,166.34,106.34a8,8,0,0,1,11.32,0L216,144.69' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3C/svg%3E") center / contain no-repeat !important;
  mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Crect x='40' y='40' width='176' height='176' rx='8' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Ccircle cx='96' cy='96' r='16' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cpath d='M56.69,216,166.34,106.34a8,8,0,0,1,11.32,0L216,144.69' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3C/svg%3E") center / contain no-repeat !important;
}
.field-area[aria-label*="file" i] span.opacity-50::after {
  content: "" !important;
  display: block !important;
  width: 24px !important;
  height: 24px !important;
  background: ${c.brand} !important;
  -webkit-mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cpath d='M160,80,76.69,164.69a16,16,0,0,0,22.63,22.62L198.63,86.63a32,32,0,0,0-45.26-45.26L54.06,142.06a48,48,0,0,0,67.88,67.88L204,128' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3C/svg%3E") center / contain no-repeat !important;
  mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cpath d='M160,80,76.69,164.69a16,16,0,0,0,22.63,22.62L198.63,86.63a32,32,0,0,0-45.26-45.26L54.06,142.06a48,48,0,0,0,67.88,67.88L204,128' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3C/svg%3E") center / contain no-repeat !important;
}
.field-area[aria-label*="upload" i] span.opacity-50::after {
  content: "" !important;
  display: block !important;
  width: 24px !important;
  height: 24px !important;
  background: ${c.brand} !important;
  -webkit-mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cpath d='M160,80,76.69,164.69a16,16,0,0,0,22.63,22.62L198.63,86.63a32,32,0,0,0-45.26-45.26L54.06,142.06a48,48,0,0,0,67.88,67.88L204,128' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3C/svg%3E") center / contain no-repeat !important;
  mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cpath d='M160,80,76.69,164.69a16,16,0,0,0,22.63,22.62L198.63,86.63a32,32,0,0,0-45.26-45.26L54.06,142.06a48,48,0,0,0,67.88,67.88L204,128' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3C/svg%3E") center / contain no-repeat !important;
}
.field-area[aria-label*="stamp" i] span.opacity-50::after {
  content: "" !important;
  display: block !important;
  width: 28px !important;
  height: 28px !important;
  background: linear-gradient(135deg, ${c.brandLight}, ${c.brand}) !important;
  -webkit-mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cline x1='40' y1='224' x2='216' y2='224' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cpath d='M114.32,136,96.54,53A24,24,0,0,1,120,24h16a24,24,0,0,1,23.47,29l-17.78,83' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Crect x='40' y='136' width='176' height='56' rx='8' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3C/svg%3E") center / contain no-repeat !important;
  mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cline x1='40' y1='224' x2='216' y2='224' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cpath d='M114.32,136,96.54,53A24,24,0,0,1,120,24h16a24,24,0,0,1,23.47,29l-17.78,83' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Crect x='40' y='136' width='176' height='56' rx='8' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3C/svg%3E") center / contain no-repeat !important;
}
.field-area[aria-label*="payment" i] span.opacity-50::after {
  content: "" !important;
  display: block !important;
  width: 24px !important;
  height: 24px !important;
  background: ${c.brand} !important;
  -webkit-mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Crect x='24' y='56' width='208' height='144' rx='8' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cline x1='168' y1='168' x2='200' y2='168' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cline x1='120' y1='168' x2='136' y2='168' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cline x1='24' y1='96' x2='232' y2='96' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3C/svg%3E") center / contain no-repeat !important;
  mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Crect x='24' y='56' width='208' height='144' rx='8' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cline x1='168' y1='168' x2='200' y2='168' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cline x1='120' y1='168' x2='136' y2='168' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3Cline x1='24' y1='96' x2='232' y2='96' fill='none' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='16'/%3E%3C/svg%3E") center / contain no-repeat !important;
}

/* Step progress dots: smaller, tighter */
.steps-progress button { height: 8px !important; width: 8px !important; margin: 2px 3px 0 !important; }
/* Completed/current are bg-base-300, upcoming bg-white */
.steps-progress button:not(.bg-white) { background-color: ${c.brand} !important; border-color: ${c.brand} !important; }
.steps-progress button.bg-white { border-color: ${c.cardBorder} !important; }
.steps-progress-current { background-color: ${c.brandLight} !important; border-color: ${c.brandLight} !important; }
.link { color: ${c.brand} !important; }
`;
}

export function getDocusealCustomCss(isDark: boolean): string {
  return buildCss(isDark ? DARK : LIGHT);
}

/** Proxy-voice replacements for DocuSeal's default UI strings. */
export const DOCUSEAL_I18N: Record<string, string> = {
  type_here_: "Type your answer…",
  next: "Next",
  submit: "Submit",
  complete: "Sign and finish",
  sign_and_complete: "Sign and finish",
  draw_signature: "Draw your signature",
  type_signature_here: "Type your signature",
  draw_initials: "Draw your initials",
  type_initial_here: "Type your initials",
  set_today: "Use today's date",
  form_has_been_completed: "All signed. You're set.",
  document_has_been_signed: "All signed. You're set.",
};
