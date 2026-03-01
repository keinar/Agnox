---
name: ui-a11y-test-sync
description: >
  Injects and maintains `data-testid` and ARIA/semantic accessibility attributes
  across React (.tsx/.jsx) components. Triggered on specific files or inline code.
  Preserves all pre-existing attributes. Outputs updated code and a full diff report.
version: 1.0.0
---

# UI A11y & Test-ID Sync

Scans React components and injects missing `data-testid` attributes for Playwright/Cypress
targeting and ARIA/semantic attributes for WCAG 2.1 AA compliance. Never overwrites
attributes that already exist.

## Triggers

- "Run A11ySync on `<path>`"
- "Sync test IDs in `<path>`"
- "Run ui-a11y-test-sync"
- User pastes component code and asks for test IDs / a11y attributes

---

## Workflow

### Step 1 — Read & Map

1. If a file path is provided, read the full file with the Read tool.
2. If inline code was pasted, treat it as the target.
3. Identify and catalogue every element in the component into three buckets:
   - **Interactive**: `<button>`, `<a>`, `<input>`, `<select>`, `<textarea>`, `<form>`,
     custom `<div>`/`<span>` with `onClick`, or elements with `role="button"` etc.
   - **Dynamic / overlay**: elements conditionally rendered or driven by state
     (modals, drawers, dropdowns, tooltips, toasts).
   - **Layout containers**: `<aside>`, `<nav>`, `<header>`, `<footer>`, `<main>`,
     `<section>`, `<dialog>`, or major wrapping `<div>`s that represent a distinct
     UI region.

### Step 2 — Inject `data-testid` Attributes

Rules (apply in order, stop at first match):

1. **Skip** — element already has a `data-testid` attribute. Do not touch it.
2. **Name generation** — produce a descriptive, kebab-case identifier:
   - Format: `{component-name}-{region?}-{element-type}`
   - Examples:
     - Desktop sidebar wrapper → `data-testid="sidebar-desktop"`
     - Mobile sidebar wrapper → `data-testid="sidebar-mobile"`
     - Main navigation → `data-testid="sidebar-main-nav"`
     - Collapse/expand toggle → `data-testid="sidebar-collapse-button"`
     - Mobile close button → `data-testid="sidebar-mobile-close-button"`
     - A settings tab button in a `.map()` → `` data-testid={`sidebar-settings-tab-${id}`} ``
     - A nav link in a `.map()` → `` data-testid={`sidebar-nav-${label.toLowerCase().replace(/\s+/g, '-')}`} ``
     - Login submit button → `data-testid="login-submit-button"`
     - Invite modal form → `data-testid="invite-modal-form"`
     - Email input inside a form → `data-testid="invite-email-input"`
3. **Dynamic/mapped elements** — use a template literal with the loop variable so
   each instance gets a unique, stable ID. Prefer `id`, `slug`, or `label` values
   already present on the object over numeric indices.
4. **Specificity tie-break** — when multiple similar elements exist in one component,
   suffix with `-primary`, `-secondary`, or a meaningful qualifier rather than `-1`, `-2`.

### Step 3 — Inject A11y Attributes (ARIA & Semantic HTML)

Apply each rule independently. Skip a rule if the relevant attribute is already present.

#### 3a — Icon-only buttons and links
- Condition: a `<button>` or `<a>` whose children contain only a Lucide/SVG icon
  component or `<img>` with no visible text sibling.
- Action: add `aria-label="<clear description of the action>"`.
- Example: a button rendering only `<X size={18} />` → `aria-label="Close sidebar"`.

#### 3b — Dynamic toggle buttons (`aria-expanded`)
- Condition: a `<button>` whose `onClick` sets a boolean state variable that shows
  or hides another element (dropdown, drawer, panel, modal).
- Action: add `aria-expanded={stateBooleanVar}` and `aria-controls="<id-of-controlled-element>"`.
- If the controlled element has no `id`, add one (use kebab-case matching the testid).
- Example: collapse toggle → `aria-expanded={!isCollapsed}` `aria-controls="sidebar-sliding-nav"`.

#### 3c — Hidden/shown overlay elements (`aria-hidden`)
- Condition: a conditionally rendered overlay (`{condition && <Element>}`) or an
  element whose visibility is controlled by CSS transform/opacity driven by state.
- Action: add `aria-hidden={!conditionVar}` (or `aria-hidden={isCollapsed}` etc.)
  to the element itself when it can be invisible to the user but still in the DOM.

#### 3d — Input / label pairing
- Condition: an `<input>`, `<select>`, or `<textarea>` that lacks both an `id`
  and an associated `<label htmlFor="…">`.
- Action (prefer in order):
  1. If a sibling/parent `<label>` exists without `htmlFor`, add `id` to the input
     and `htmlFor={id}` to the label.
  2. If no label element exists, add `aria-label="<descriptive label>"` to the input.
  3. If a visible text element nearby describes the input, add
     `aria-labelledby="<id-of-that-element>"` and an `id` to the text element.

#### 3e — Interactive non-semantic elements
- Condition: `<div>` or `<span>` with an `onClick` handler but without
  `role`, `tabIndex`, `aria-label`.
- Action: add `role="button"`, `tabIndex={0}`, `aria-label="<description>"`,
  and verify an `onKeyDown` handler exists that fires on `Enter`/`Space`.
  If missing, suggest adding the handler (do not silently omit keyboard support).

#### 3f — Navigation landmarks
- Condition: `<nav>` element without an `aria-label`.
- Action: add `aria-label` describing the navigation region.
- Examples: `aria-label="Main navigation"`, `aria-label="Settings navigation"`.

#### 3g — Dialogs and modals
- Condition: `<dialog>`, or a `<div role="dialog">` / overlay component.
- Action: ensure `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`
  pointing to the modal's heading `id`. Add the `id` to the heading if missing.

### Step 4 — Safety & Preservation Rules (NON-NEGOTIABLE)

- **Never overwrite** any existing `data-testid`, `id`, `aria-*`, or `role` attribute.
- **React syntax only**: use `htmlFor` (not `for`), `tabIndex` (not `tabindex`),
  `className` (not `class`), camelCase event handlers (`onClick`, `onKeyDown`).
- **No functional changes**: do not modify logic, state, styling, imports, or prop types.
- **No new imports**: do not add React, hooks, or utility imports.
- **Template literals in JSX**: use `{`backtick string`}` syntax, not string concatenation.
- **Preserve formatting**: match the surrounding indentation and brace style exactly.
- When uncertain about the correct `aria-label` text, insert a `{/* TODO a11y: confirm label */}`
  comment and use a sensible placeholder rather than leaving the attribute out.

---

## Output Format

Return two sections:

### Section 1 — Updated Component Code

Output the complete, updated file contents. Do not truncate. Wrap in a fenced code
block with the language tag (`tsx` or `jsx`).

### Section 2 — Sync Report

Use this exact format:

```
## A11y & Test-ID Sync Report — [COMPONENT_NAME]

### data-testid Injected
| Element | Attribute Added |
|---------|----------------|
| <aside> (desktop sidebar) | data-testid="sidebar-desktop" |
| ... | ... |

### ARIA Attributes Injected
| Element | Attribute Added | Reason |
|---------|----------------|--------|
| <button> (mobile close, icon-only) | aria-label="Close sidebar" | Icon-only button |
| ... | ... | ... |

### Preserved (not touched)
- `data-testid` on <X> — already present
- `aria-label` on collapse toggle — already present

### Warnings / Manual Review Needed
- <element>: [describe what needs human judgement]
```

---

## Rules

- Never fabricate element IDs or ARIA relationships you cannot verify from the code.
- If a state variable's name is ambiguous, add a `{/* TODO a11y: verify aria-expanded source */}` comment.
- Do not modify any logic, imports, Tailwind classes, or prop signatures.
- Run the full workflow even if only one attribute is missing — the report must always be complete.
