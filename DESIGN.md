---
name: Tactile Playful Modern
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#434655'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#855300'
  on-secondary: '#ffffff'
  secondary-container: '#fea619'
  on-secondary-container: '#684000'
  tertiary: '#006242'
  on-tertiary: '#ffffff'
  tertiary-container: '#007d55'
  on-tertiary-container: '#bdffdb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 17px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 17px
    fontWeight: '500'
    lineHeight: 26px
    letterSpacing: 0em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.03em
  display-accent:
    fontFamily: Plus Jakarta Sans
    fontSize: 38px
    fontWeight: '800'
    lineHeight: 44px
    letterSpacing: -0.025em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1.25rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.875rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes an encouraging, highly responsive learning companion for adult and young-adult beginners (CEFR A1–A2) venturing into spoken English. The atmosphere merges the polished spatial discipline of iOS system software with the kinetic optimism of gamified language learning. The emotional tone avoids both dry academic rigidity and juvenile cartoons; it feels clean, tactile, intelligent, and warm.

Visually, the direction pairs pristine surfaces with subtle physical tactility. Elements feel interactable and soft to the touch—employing gentle directional depth, squash-and-stretch micro-states, and distinct surface separation. Visual complexity is minimized to reduce cognitive load during voice-first interaction: safe margins are generous, typography is assertive and legible, and communicative color accents directly signal pronunciation fidelity, voice reception, and session progression.

## Colors

The palette relies on high-contrast semantic discipline against an ultra-clean, neutral canvas:

- **Primary (`#2563EB` - Cobalt Focus):** Communicates clarity, intelligence, and system guidance. Used for primary step progression, active audio recording states, key interactive links, and focused input borders.
- **Secondary (`#F59E0B` - Amber Whiskers):** The persona and reward anchor. Applied to the feline companion avatar, streak counters, XP badges, warm encouragement callouts, and conversational hints.
- **Tertiary (`#10B981` - Emerald Praise):** Reserved strictly for affirmative educational feedback—successful phonetic attempts, perfect syntax matches, and completed learning loops.
- **Error / Exit (`#EF4444` - Soft Crimson):** Communicates conversational stalls, mispronunciations needing review, and destructive session cancellations.
- **Surfaces & Neutral Foundation:** 
  - Canvas base: Slate Tint (`#F8FAFC`)
  - Elevated cards & containers: Pure White (`#FFFFFF`)
  - Subtle architectural borders: Slate Border (`#E2E8F0`)
  - Deep text / Titles: Slate 900 (`#0F172A`)
  - Running narrative / Assistant dialog: Slate 600 (`#475569`)
  - Secondary metadata / Translations / Waveform idle bars: Slate 400 (`#94A3B8`)

Color is applied functional-first: interactive buttons leverage solid fills with slight underlying 3D base borders, while conversational feedback wraps dialog containers in low-saturation tinted surfaces (e.g., `#ECFDF5` for Emerald praise containers) to preserve high legibility.

## Typography

The typography leverages **Plus Jakarta Sans** across all levels, offering a clean, contemporary grotesque structure tempered by rounded terminals and open apertures reminiscent of Apple's system typography. This geometry guarantees rapid decipherability for beginner language learners parsing unfamiliar Latin word shapes.

- **Display & Headlines:** Heavy weights (700 and 800) supply clear hierarchy and an upbeat cadence. Headings pair tightly with character reaction art and audio status banners.
- **Body & Dialogue:** Set at medium weights (400 to 500) with balanced line-heights (1.45–1.5x) to accommodate English phonetics and localized Korean subtext underneath conversational bubbles without visual crowding.
- **Phonetic & Pronunciation Display:** Dialogue highlighting utilizes `body-lg` at `600` weight, with missed phonemes indicated via soft inline color pills rather than raw underlines.
- **Labels & Microcopy:** Crisp medium-to-bold weights ensure status tags, audio speed toggles (`1.0x`, `0.8x`), and translation switches remain legible at glance-scale.

## Layout & Spacing

The layout is built mobile-first around an adaptive fluid single-column frame configured for thumb-zone comfort and live dialogue flow.

- **Vertical Structure:** The screen viewport prioritizes a dynamic three-tier split:
  1. *Top Bar (48–56px):* Progress meter, companion mood indicator, streak count, exit control.
  2. *Mid-Canvas (Scrollable Fluid):* Conversational chat feed, embedded pronunciation cards, live speech transcripts, and real-time feline character reactions.
  3. *Bottom Fixed Thumb Deck (120–160px):* Tactile input controls, persistent audio waveform feedback, speed adjustments, and the primary push-to-talk actuator.
- **Spacing Rhythm:** Based on an 8pt architectural grid with 4pt half-steps for component micro-padding (`space-xs`).
- **Breakpoints:**
  - *Compact (≤ 428px):* Native phone layout with standard `1rem` screen margin and locked bottom action shelf.
  - *Medium (429px – 768px):* Constrained content container locked to a maximum width of `480px` centered horizontally, preserving native mobile proportions on foldables and tablets.

## Elevation & Depth

This system avoids heavy drop shadows, instead using **tonal layered surfaces with crisp tactile offset borders** to create playful, touch-friendly physical affordance.

- **Base Ground:** Canvas sits at `#F8FAFC`.
- **Level 1 (Cards & Chat Bubbles):** Pure White (`#FFFFFF`) with a solid 1px structural stroke in `#E2E8F0`. Soft ambient diffusion is cast via `0px 2px 8px rgba(15, 23, 42, 0.04)`.
- **Level 2 (Tactile Push Buttons & Floating Badges):** Dual-layer construction. An upper surface layer accompanied by a 2px to 4px solid pseudo-shadow at the bottom (e.g., Cobalt `#2563EB` button resting over `#1D4ED8` base depth). When pressed, the surface translates downward 2px to eliminate the shadow, simulating a physical spring button.
- **Level 3 (Modal Sheets & Celebratory Overlays):** Deep ambient illumination `0px 12px 32px -4px rgba(15, 23, 42, 0.12)`, paired with a tinted backdrop blur (`backdrop-filter: blur(12px); background: rgba(15, 23, 42, 0.3)`).
- **Audio Active Halo:** Dynamic pulsating ambient glow using low-opacity Primary or Character accents (`0px 0px 24px rgba(37, 99, 235, 0.25)`), expanding synchronously with user speech volume.

## Shapes

The shape vocabulary uses an organic, highly welcoming contour system. The high roundedness factor (`level 3`) produces ultra-friendly, pebble-like ergonomics across every point of contact.

- **Pill Shapes (Full Rounding):** Action buttons, status chips, audio speed selectors, and pronunciation scores rely on continuous curvature capsules (`border-radius: 9999px`).
- **Chat Bubbles:** Generous 20px corners with tailored asymmetric anchor corners (4px radius on the originating speaker's anchor corner) establishing immediate conversational provenance.
- **Cards & Modals:** Large 24px to 32px radii deliver an approachable, non-aggressive presentation.
- **Paw-Pad Mic Element:** Concentric organic circles forming the primary voice button, combining an outer reactive ring with an inner tactile core.

## Components

### Buttons
- **Tactile Action Button (Primary):** Pill-shaped, Cobalt Blue fill with a 3px darker under-edge (`#1D4ED8`). Typography is `label-lg` in `#FFFFFF`. On active press: translates down 3px with under-edge compressed.
- **Secondary Companion Button:** Amber Orange (`#F59E0B`) fill with `#D97706` tactile under-edge for hint unlocks, cat interactions, and special conversational interventions.
- **Ghost/Tertiary Action:** White background, 1.5px `#E2E8F0` border, `#0F172A` text, providing clean utility without competing with audio actions.

### Interactive Voice Actuator (Paw-Pad Mic)
- A 76px circular physical-style button positioned centrally in the bottom deck.
- Soft Cobalt background with an embossed silhouette of a cat paw pad.
- Encircled by an animated SVG ring that expands into an active waveform during voice input. Supports both tap-to-talk and hold-to-stream interaction models.

### Chat & Dialogue Bubbles
- **Tutor Bubble (TalkyCat):** White background, `#E2E8F0` border, Slate 900 primary text. Accompanied by a mini speaker icon for instantaneous replay, and an expandable Korean translation hint rendered in `body-sm` Slate 400.
- **Learner Bubble:** Soft tinted Cobalt base (`#EFF6FF`), Slate 900 text, aligned to the trailing edge. Contains inline phoneme validation marks (words colored in Emerald `#10B981` when articulated clearly; words underlined in Amber `#F59E0B` if pronunciation was hesitant).

### Audio Waveforms & Audio Cards
- Rhythmically pulsating vertical capsule bars (3px width, rounded tips).
- Idle state: Slate 200 (`#E2E8F0`).
- User Speaking: Real-time amplitude mapping shifting between Cobalt Blue (`#2563EB`) and Emerald Green (`#10B981`).

### Pill Chips & Vocabulary Tags
- Height: 32px.
- Enclosed with 1px border and pill radius.
- Inactive: `#FFFFFF` fill, `#E2E8F0` border, `#475569` text.
- Active/Selected: Tinted fill (e.g., `#FEF3C7` Amber) with solid `#F59E0B` border and text.

### Form Inputs & Text Fields
- 52px height container, 16px corner radius, `#FFFFFF` surface with 1.5px `#E2E8F0` stroke.
- Focus state shifts stroke to 2px solid `#2563EB` with an ambient glow. Placeholder rendered in `body-md` Slate 400.

### Checkboxes & Segmented Controls
- Segmented switches wrapped in `#F1F5F9` troughs with an animated sliding white pill selector.
- Checkboxes feature rounded 8px squares with an animated bouncing checkmark upon successful pronunciation validation.

### Bottom Sheet Drawer
- Anchored to the viewport bottom with 28px top radii, pure white surface, and a 36px wide Slate 300 drag handle.
- Houses vocabulary breakdowns, detailed grammar insights, and phonetic replay controls without fully ejecting the student from the conversation flow.

### Celebratory Feedback Modal
- Pop-in modal backed by soft ambient blur.
- Features a prominent mood graphic of TalkyCat, an animated star/paw burst, an Emerald Green celebration banner, pronunciation accuracy percentage score (`display-accent`), and a full-width tactile progression button.