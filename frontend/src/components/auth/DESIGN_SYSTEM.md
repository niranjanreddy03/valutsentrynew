# VaultSentry — Auth Design System

Shared primitives and tokens used across `/login`, `/register`, `/forgot-password`,
`/terms`, and `/mfa-setup`. Built on Tailwind with a dark-first cybersecurity aesthetic.

---

## 1. Palette

All colors live in `tailwind.config.js`. Use the semantic tokens — avoid raw hex.

| Role | Token | Hex | Use |
|---|---|---|---|
| Surface (page) | `slate-950` | `#030712` | Page background |
| Surface (card) | `slate-900/60` + `backdrop-blur-xl` | — | Glass card |
| Border | `white/10` | — | Card + input borders |
| Accent primary | `cyber-blue` | `#3b82f6` | Gradient start, focus rings |
| Accent hero | `cyber-cyan` | `#06b6d4` | Gradient end, links, active stepper |
| Accent success | `cyber-green` | `#22c55e` | Password meter, "done" states |
| Accent warn | `cyber-purple` | `#8b5cf6` | Reserved — secondary CTAs |
| Error | `red-500` | `#ef4444` | Input error ring, toasts |
| Text primary | `white` | — | Titles, strong values |
| Text body | `slate-300` | — | Paragraph copy |
| Text muted | `slate-400` | — | Labels, hints |
| Text dim | `slate-500` | — | Placeholders, disabled |

Gradient CTA: `bg-gradient-to-br from-cyber-blue to-cyber-cyan` + `shadow-glow-sm`.

---

## 2. Typography

- **Font family:** `font-sans` → Inter (system fallback). Mono → JetBrains Mono (for secrets/codes).
- **Card title** — `text-2xl font-semibold tracking-tight text-white`
- **Subtitle / helper** — `text-sm text-slate-400`
- **Label** — `text-sm font-medium text-slate-200`
- **Body** — `text-sm leading-relaxed text-slate-300`
- **Hint / meta** — `text-xs text-slate-500`
- **Code / secret keys** — `font-mono text-xs text-cyber-cyan`

Never use font sizes below `text-xs` (12px).

---

## 3. Spacing & layout

- **Auth card width:** `max-w-[440px]` — fits comfortably on desktop without looking cramped on mobile.
- **Card padding:** `p-7 sm:p-8` (28 / 32 px).
- **Vertical rhythm inside forms:** `space-y-4` between fields, `space-y-5` between grouped blocks.
- **Input height:** `py-2.5` → 42 px tall (comfortable tap target, matches button height).
- **Button height:** `py-2.5 px-4` → matches inputs for visual alignment.
- **Corners:** `rounded-xl` (inputs, buttons) • `rounded-2xl` (cards) • `rounded-full` (pills/badges).

---

## 4. Shadows & glows

Defined in `tailwind.config.js`:

- `shadow-glass` — subtle elevation for cards (`0 8px 32px rgba(0,0,0,.3)`).
- `shadow-glow-sm|md|lg` — blue glow for primary CTA hover.
- `shadow-glow-success|critical|warning` — semantic glows for status surfaces.
- Focus rings use soft inner shadows: `shadow-[0_0_0_3px_rgba(6,182,212,0.15)]`.

---

## 5. Motion

| Animation | Class | When |
|---|---|---|
| Card mount | `animate-scale-in` | Every `<AuthCard>` on mount |
| Grid pan | `animate-grid-pan` | Background grid on `<AuthLayout>` |
| Field error | `animate-shake` | Triggered via `shake` prop on `AuthCard` |
| Toast / banner | `animate-slide-up` | Top-level feedback |
| Button loading | `animate-spin` (Loader2) | `loading` prop on `AuthButton` |

All durations stay ≤ 450 ms. No bouncy easings on forms (use `ease-out`).

---

## 6. Component API

Import from `@/components/auth`:

```ts
import {
  AuthLayout, AuthCard, AuthInput, AuthButton,
  OtpInput, PasswordStrength, Stepper, OAuthButtons, Divider,
} from '@/components/auth'
```

### `<AuthLayout>`
Dark page shell. `children` = centered card column. Optional `aside` renders a 2nd column ≥ `lg`.

### `<AuthCard>`
- `title`, `subtitle`, `children`, `footer`
- `shake?: boolean` — wiggle on validation failure.

### `<AuthInput>`
- Left `icon`, right `trailing` slot (e.g. "Forgot password?").
- `togglePassword` renders show/hide eye when `type="password"`.
- `error` replaces the hint row with a red message and swaps ring color.

### `<AuthButton>`
- `variant: "primary" | "secondary" | "ghost"` (default `primary`).
- `loading` shows spinner and disables.
- `leadingIcon` renders icon before label (hidden while loading).

### `<OtpInput>`
- 6-digit segmented code, paste-aware, auto-advance, backspace-aware.
- Fires `onComplete(code)` when all digits filled.

### `<PasswordStrength>`
- Renders meter + rule list once user starts typing (pass `showWhenEmpty` to force-render).
- Export `scoreOf(password)` returns 0–4 for form-level gating (we gate at `>= 3`).

### `<Stepper>`
- Compact inline progress for multi-step flows. `steps: string[]`, `current: 0-based`.

### `<OAuthButtons>`
- Two stacked buttons (GitHub, Google). `onProvider(provider)` handler.
- `loading: "github" | "google" | null` shows per-button spinner.

### `<Divider>`
- Horizontal rule with centered label, spacing built in.

---

## 7. Consistency rules

1. **One card per screen.** Even multi-step flows stay inside a single `<AuthCard>` to avoid jarring remounts — swap inner content instead.
2. **Always give errors a home.** Inline `role="alert"` red banner above the CTA, never a toast-only error.
3. **Primary CTA is the only gradient on the screen.** OAuth + skip buttons are secondary/ghost.
4. **Every step is reversible.** Back links use the `ArrowLeft` icon + `text-xs text-slate-400`.
5. **Disable the CTA, don't hide it.** Users should always know what the primary action is.
6. **Never block on OAuth during local auth fallback.** Surface failures via `useToast`, keep the form usable.
7. **Respect reduced motion.** All animation classes should degrade; prefer opacity/transform (GPU-friendly).

---

## 8. Page anatomy

```
┌─ AuthLayout ─────────────────────────────────────────────┐
│  [logo]                                  [back to site]   │
│                                                           │
│  ┌─ AuthCard (440px) ──────┐   ┌─ aside (lg+) ────────┐   │
│  │ Title                   │   │ Pitch / trust       │   │
│  │ Subtitle                │   │ signals             │   │
│  │ ─ Stepper (multi-step)  │   └──────────────────────┘   │
│  │                         │                              │
│  │ form fields             │                              │
│  │ inline error            │                              │
│  │ [ Primary CTA ]         │                              │
│  │ ── or ──                │                              │
│  │ [ OAuth buttons ]       │                              │
│  │                         │                              │
│  │ ─ footer (terms link)   │                              │
│  └─────────────────────────┘                              │
└───────────────────────────────────────────────────────────┘
```

---

## 9. Accessibility

- Inputs pair `label` ↔ `id` via name fallback inside `<AuthInput>`.
- OTP inputs are labelled `Digit 1..n` and use `inputMode="numeric"`.
- Focus-visible rings use a 3px soft ring (not the browser default) and stay on both keyboard and click.
- Color alone is never the only error indicator — shake + icon + text accompany red.
- Password-reveal toggle is `tabIndex={-1}` so keyboard users tab straight to the next field.
