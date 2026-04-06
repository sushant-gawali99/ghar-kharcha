# Design System: Fresh & Fast Analytics

## 1. Overview & Creative North Star: "The Vibrant Orchard"
This design system is built to transform mundane grocery data into an energetic, editorial experience. We are moving away from the "utility-only" spreadsheet look of traditional analytics and toward a **"Vibrant Orchard"** aesthetic. 

The strategy focuses on **Organic Momentum**: using ultra-rounded shapes (2rem+ radii), high-contrast typography scales, and a "No-Line" philosophy. By utilizing intentional asymmetry and overlapping "glass" layers, we create a sense of speed and freshness reflective of the Indian quick-commerce market. The UI should feel like a premium lifestyle magazine—airy, bold, and hyper-responsive.

---

## 2. Colors & Surface Philosophy
Our palette is a celebration of freshness. We use "Electric Green" as our primary driver, supported by a fruit-inspired secondary palette.

### Color Tokens (Material Design Convention)
*   **Primary (Electric Green):** `#006a28` | **Container:** `#56fe7c` (The pulse of the app)
*   **Secondary (Coral/Berry):** `#b60d3d` | **Container:** `#ffc2c6` (Urgency and accents)
*   **Tertiary (Vibrant Yellow):** `#6d5a00` | **Container:** `#fdd400` (Highlights and savings)
*   **Background:** `#f6f6f9` (Cool-toned off-white)
*   **Surface Tiers:** 
    *   `surface-container-lowest`: `#ffffff` (Pure white for top-level cards)
    *   `surface-container-low`: `#f0f0f3` (Subtle sectioning)
    *   `surface-container-high`: `#e1e2e6` (Nested depth)

### The "No-Line" Rule
**Prohibit 1px solid borders for sectioning.** Boundaries must be defined solely through background color shifts. To separate a "Monthly Spend" card from the background, place a `surface-container-lowest` card atop a `surface` background. The change in luminance is your divider.

### The Glass & Gradient Rule
To achieve "High-End Editorial" depth:
*   **Floating Navigation:** Use `surface-container-lowest` with 80% opacity and a `20px` backdrop-blur. 
*   **Signature Textures:** Main CTAs (like "Analyze Cart") should use a linear gradient from `primary` (`#006a28`) to `primary-container` (`#56fe7c`) at a 135° angle. This adds a "juice" factor that flat fills lack.

---

## 3. Typography: Editorial Authority
We pair **Plus Jakarta Sans** (Headings) with **Inter** (Data/Body) to balance personality with legibility.

*   **Display (Plus Jakarta Sans):** Used for big "Hero" numbers (e.g., total monthly savings). Use `display-lg` (3.5rem) with tight letter-spacing (-0.04em).
*   **Headline (Plus Jakarta Sans):** Used for category titles. `headline-sm` (1.5rem) should always be semi-bold to anchor the page.
*   **Body (Inter):** All grocery list items and descriptions. `body-md` (0.875rem) provides the necessary breathing room for long lists.
*   **Label (Plus Jakarta Sans):** Small, all-caps metadata (e.g., "UNIT PRICE"). Use `label-md` with +0.05em tracking for a premium "engineered" feel.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are too heavy for a "Fresh" system. We use **Tonal Layering**.

*   **The Layering Principle:** Stack surfaces like sheets of paper. 
    *   *Level 0:* `background` (`#f6f6f9`)
    *   *Level 1:* `surface-container-low` (Content areas)
    *   *Level 2:* `surface-container-lowest` (Interactive cards)
*   **Ambient Shadows:** If an element must float (e.g., a "Quick Add" FAB), use a shadow tinted with `on-surface` color: `rgba(45, 47, 49, 0.06)` with a 32px blur and 16px Y-offset.
*   **Ghost Borders:** For accessibility on white-on-white areas, use `outline-variant` (`#acadaf`) at **10% opacity**. It should be felt, not seen.

---

## 5. Components & Primitives

### Buttons: The "Pill" Format
*   **Primary:** Full rounded (`9999px`), Gradient fill, White text. Large padding (16px 32px).
*   **Secondary:** `secondary-container` fill with `on-secondary-container` text. No border.
*   **Tertiary:** Ghost style with `primary` text. No container.

### Roundedness Scale
*   **Cards:** Use `lg` (2rem) for main dashboard cards.
*   **Chips:** Use `full` (9999px) for category tags (e.g., "Vegetables", "Dairy").
*   **Small Elements:** Use `sm` (0.5rem) only for checkboxes or tooltips.

### Cards & Lists: Editorial Flow
*   **Forbid Dividers:** Never use a horizontal line between list items. Use 16px of vertical white space or alternating `surface-container` shifts.
*   **The "Expressive Chip":** Chips should use vibrant fills (e.g., `tertiary-container` for "Best Seller") to act as visual punctuation marks within data-heavy screens.

### Contextual Components (India Market)
*   **₹ Currency Display:** Use `Plus Jakarta Sans` Bold for the amount, but scale the ₹ symbol to 70% of the number's height to keep the focus on the value.
*   **Quantity Steppers:** Use large, circular `primary-container` buttons for +/- to accommodate "fat-finger" interactions common in fast-paced grocery shopping.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use asymmetrical layouts. A large card on the left paired with two smaller stacked cards on the right creates a "Z-pattern" that feels modern.
*   **Do** use duotone icons. Use `primary` for the main shape and `primary-container` for the accent piece of the icon.
*   **Do** embrace white space. If a screen feels "empty," it’s likely working.

### Don’t:
*   **Don’t** use pure black (`#000000`). Always use `on-surface` (`#2d2f31`) for text to maintain the soft, premium feel.
*   **Don’t** use sharp corners. Anything less than `0.5rem` radius is prohibited as it breaks the "Fresh" friendliness.
*   **Don’t** use standard Material Design blue. Stick to the "Fresh & Fast" palette (Teal/Lime/Electric Green) to avoid looking like a generic utility app.