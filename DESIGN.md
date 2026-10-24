---
name: "POLUBU Smart meeting"
description: "Thai-first meeting resolution workspace with a deep teal shell and light reading surfaces."
colors:
  primary: "#173b42"
  primary-hover: "#285058"
  accent: "#b87120"
  background: "#f5f7f7"
  surface: "#fff"
  ink: "#253b40"
  muted: "#5c7068"
  line: "#e0e7e5"
  teal-light: "#e9f1ef"
  danger: "#b84436"
  success: "#247457"
  button-danger: "#b64436"
  button-danger-hover: "#983b30"
  secondary-hover: "#f1f5f3"
  ghost-hover: "#eaf0ed"
  input-border: "#d9e2df"
  nav-text: "#c2d4d1"
  nav-hover: "#254b50"
  nav-active: "#f2c17d"
  nav-active-text: "#324139"
  badge-neutral-text: "#5d6f68"
  badge-neutral-bg: "#edf2ef"
  badge-info-text: "#326c76"
  badge-info-bg: "#e8f2f4"
  badge-success-text: "#26724d"
  badge-success-bg: "#e7f3ea"
  badge-warning-text: "#94601e"
  badge-warning-bg: "#fff2dc"
  badge-danger-text: "#b14b3f"
  badge-danger-bg: "#fcece8"
  focus: "#c88738"
  progress-fill: "#6c9c83"
  progress-track: "#eaf0ec"
  workflow-assigned: "#b5c3ba"
  workflow-in-progress: "#557e87"
  workflow-submitted: "#deb471"
  workflow-revision: "#c77e69"
  workflow-accepted: "#7ea68b"
  workflow-cancelled: "#d1d9d4"
typography:
  display:
    fontFamily: "IBM Plex Sans Thai, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "IBM Plex Sans Thai, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "-0.02em"
  title:
    fontFamily: "IBM Plex Sans Thai, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.45
  body:
    fontFamily: "IBM Plex Sans Thai, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "IBM Plex Sans Thai, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.5
  metadata:
    fontFamily: "IBM Plex Sans Thai, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.65
  badge:
    fontFamily: "IBM Plex Sans Thai, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.5
  navigation:
    fontFamily: "IBM Plex Sans Thai, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.65
rounded:
  progress: "3px"
  badge: "5px"
  field: "7px"
  control: "8px"
  notice: "10px"
  panel: "12px"
  dialog: "14px"
spacing:
  compact: "8px"
  inline: "10px"
  small: "16px"
  form: "18px"
  stack: "20px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.secondary-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  button-ghost-hover:
    backgroundColor: "{colors.ghost-hover}"
    textColor: "{colors.primary}"
  button-danger:
    backgroundColor: "{colors.button-danger}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  button-danger-hover:
    backgroundColor: "{colors.button-danger-hover}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "9px 12px"
    width: "100%"
  navigation:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.nav-text}"
    typography: "{typography.navigation}"
    rounded: "{rounded.control}"
    padding: "10px 13px"
  navigation-hover:
    backgroundColor: "{colors.nav-hover}"
    textColor: "{colors.surface}"
  navigation-active:
    backgroundColor: "{colors.nav-active}"
    textColor: "{colors.nav-active-text}"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  progress:
    backgroundColor: "{colors.progress-track}"
    rounded: "{rounded.progress}"
    height: "5px"
  workflow-strip:
    height: "10px"
    rounded: "4px"
    width: "100%"
  badge-neutral:
    backgroundColor: "{colors.badge-neutral-bg}"
    textColor: "{colors.badge-neutral-text}"
    typography: "{typography.badge}"
    rounded: "{rounded.badge}"
    padding: "4px 8px"
  badge-info:
    backgroundColor: "{colors.badge-info-bg}"
    textColor: "{colors.badge-info-text}"
    typography: "{typography.badge}"
    rounded: "{rounded.badge}"
    padding: "4px 8px"
  badge-success:
    backgroundColor: "{colors.badge-success-bg}"
    textColor: "{colors.badge-success-text}"
    typography: "{typography.badge}"
    rounded: "{rounded.badge}"
    padding: "4px 8px"
  badge-warning:
    backgroundColor: "{colors.badge-warning-bg}"
    textColor: "{colors.badge-warning-text}"
    typography: "{typography.badge}"
    rounded: "{rounded.badge}"
    padding: "4px 8px"
  badge-danger:
    backgroundColor: "{colors.badge-danger-bg}"
    textColor: "{colors.badge-danger-text}"
    typography: "{typography.badge}"
    rounded: "{rounded.badge}"
    padding: "4px 8px"
---

# Design System: POLUBU Smart meeting

## Overview

This document records the implemented UI in src/app/globals.css, src/components/ui.tsx, src/components/app-shell.tsx and src/components/screens/dashboard.tsx. Local IBM Plex Sans Thai font imports are defined in src/app/layout.tsx. PRODUCT.md establishes Thai-first professional wording and a secretary as the primary audience.

The current interface uses deep teal navigation, amber selection, light green-white work surfaces and compact bordered records. The annual-report direction remains provisional, as recorded in .impeccable/surfaces/src-app-page-tsx.md; it is not a user-approved institutional identity. No creative metaphor, official palette or university seal has been approved. This is an extraction of current code, not a new visual selection.

**Key Characteristics:**
- Thai text uses one locally packaged font family with explicit weight levels.
- Navigation, records and workflow states have separate visual roles.
- Panels use borders and tonal surfaces; dialogs and toasts carry shadows.
- The implementation ships Lucide and inline SVG vectors without raster assets.

## Colors

### Primary

Deep teal, represented by primary, anchors the persistent navigation and primary actions. Its hover token belongs to action buttons; navigation has a separate hover surface. Teal-light supports quiet icon-button feedback.

### Secondary

Amber accent is used for link hover and input carets. The softer nav-active token is the selected navigation background. Focus has its own visible amber outline. These are distinct observed values, not a single interchangeable amber.

### Neutral

Background is the application canvas; surface is the white panel and control fill. Ink carries main text; muted carries secondary copy, placeholder text and corrected metadata. Line separates panels and rows. The final muted token is authoritative over earlier literal CSS declarations.

### Semantic states

Badge pairs define neutral, information, success, warning and danger states. General danger and success tokens also color required markers, warnings and toast icons. The destructive button uses its own observed color, separate from general danger. Workflow strip colors are keyed by actual task status and repeated in the legend; they are not text colors. Synthetic tonal ramps in the sidecar are preview aids, not additional approved production tokens.

## Typography

**Font family:** IBM Plex Sans Thai with sans-serif fallback. Weights 400, 500, 600 and 700 are loaded locally from @fontsource; no remote font fetch is required. The brand uses the same family rather than a separate display face.

Display is the dashboard metric figure; headline is the page heading; title is the default panel heading. Body is the desktop reading baseline. Label describes standard buttons, metadata describes repeated secondary information, and badge describes semantic chips. Smaller heading roles remain in the stylesheet for contextual use. Figures use tabular numbers in metrics, progress and dates.

At the compact breakpoint, body becomes (13px), page headings become (23px), and metric figures become (30px). Final metadata overrides retain (11px) for table subtitles, progress labels, badges, resolution codes, workflow legends, activity timestamps, the demo strip and the footer. This is not a universal minimum: some auxiliary marks and table headings still use smaller source sizes. Resolution prose uses a (72ch) maximum line length and (2) line height; header descriptions cap at (70ch).

## Layout

The desktop frame places a fixed navigation rail beside a flexible work area. The rail is (242px) wide and the top bar (72px) high; main content is centered within a (1640px) maximum width with (31px 34px 40px) padding. Shared section gaps are (24px); form columns use (18px). Panels generally use (22px 24px) body padding. These spacing names are documentation aliases for repeated source values, not additional CSS variables.

At maximum (1200px), the rail contracts to (220px) and content side padding becomes (24px). At maximum (960px), the rail is replaced by a dialog drawer, the frame loses its left offset, and the top bar becomes (65px). The drawer is (276px) wide, capped at (85vw). At maximum (680px), content uses (22px 16px 30px) padding, forms and details become one column, and page actions can wrap. Dialogs remain viewport-constrained and scroll internally.

The dashboard-specific layout reduces its side column at maximum (1280px), stacks its principal columns at maximum (1100px), and becomes a single-column side section at maximum (680px). These first-surface choices are not requirements for every screen. The four metrics become two columns on compact screens. Tables retain horizontal scroll within their container rather than compressing all columns. Printed reports hide navigation and controls and use landscape A4 with (15mm) margins.

## Elevation & Depth

Depth comes mainly from the white reading surfaces, light canvas, fine borders and dark navigation. Ordinary panels have no shadow. A modal uses (0 22px 70px #173b422e); a toast uses (0 8px 35px #173b4226). The modal and drawer backdrop is (#102b3770). Exact shadow and motion values live in the sidecar because the frontmatter schema does not represent them.

Color and border state transitions last (180ms). Progress width uses (200ms ease-out); loading skeletons pulse over (1500ms ease-in-out). The reduced-motion media query disables transitions and animation. No decorative entrance motion is implemented.

## Shapes

Panels use gently rounded corners, controls a tighter curve, and fields a slightly smaller curve. Compact rectangular badges have small corners and a circular status dot; they are not pill buttons. Dialogs have the largest shared container radius. Avatars are circles. Progress tracks are narrow rounded bars; the workflow strip uses segmented rectangles with small gaps. Borders remain thin (1px) throughout the primary component vocabulary.

## Components

### Buttons

Four shared variants are implemented: primary, secondary, ghost and danger. Standard buttons use a (40px) minimum height and label typography; the small variant uses a (32px) minimum height, (6px 11px) padding and (11px) text, returning to a (40px) minimum height on compact screens. Secondary buttons carry a pale border that darkens on hover. Ghost buttons gain a pale green surface on hover. Disabled buttons use (0.5) opacity and the unavailable cursor. All interactive controls inherit the global (3px) focus outline with (3px) offset. There is no custom pressed transform.

### Chips

Badges show a small dot in currentColor plus a Thai label. Their five semantic tones use the paired frontmatter colors. They are informational spans, not clickable filter controls. Status strings are mapped by the shared Badge component; custom labels can use its tone prop.

### Cards / Containers

Panel provides an optional title, description and action followed by a body. It uses the shared surface, line and panel radius. Header padding is (22px 24px 0); body padding is (22px 24px). Compact screens reduce these to (18px 17px 0) and (18px 17px). The no-padding variant allows tables to meet the panel edge.

### Inputs / Fields

Inputs, selects and textareas use white fill, ink text, the field radius and a thin input-border stroke. Their minimum height is (40px); textareas begin at (112px) and resize vertically. Hover darkens the border; the global focus ring marks keyboard focus. Placeholder text uses the final muted token at full opacity. Disabled fields have a pale fill and unavailable cursor. Labels and hints remain outside the field, with required marks in danger. Inline information, warning, error and success alerts supplement validation copy; no separate invalid-field border variant is implemented.

### Navigation

The dark rail uses line icons and text labels. Default links have a (44px) minimum height, active links use the amber selection fill and heavier text, and hover uses the navigation hover token. Active route links expose aria-current. The current page remains visible in the top breadcrumb. Mobile navigation uses a native dialog with a close button; search is another dialog and is available through the toolbar or the Command/Ctrl+K shortcut.

### Progress and workflow

The compact ProgressBar pairs a narrow fill with a numeric percentage and exposes progressbar values. The workflow strip is a distinct, count-proportional visualization of task states. Its segments and labeled legend link to the matching task filters. A completed percentage, submitted state and accepted state remain visibly distinct. The sidecar uses fixed sample counts only to preview the implemented pattern.

## Do's and Don'ts

### Do:
- Do use the frontmatter tokens and shared components when extending the current interface.
- Do retain the final muted text and metadata overrides at the end of globals.css when evaluating the CSS cascade.
- Do pair each workflow color with its Thai status label and a count or text explanation.
- Do preserve visible keyboard focus, text wrapping, horizontal table scrolling and reduced-motion support.
- Do treat the annual-report direction as provisional until the user explicitly selects it.

### Don't:
- Don't substitute the earlier, lighter muted text values or overridden 9px metadata styles for the final declarations.
- Don't use percent progress alone to visually imply acceptance or resolution closure.
- Don't replace Thai labels with color-only dots or unlabelled icon controls.
- Don't present the custom brand mark as an official university seal or add an institutional identity that was not supplied.
