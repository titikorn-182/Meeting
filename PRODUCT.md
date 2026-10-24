# POLUBU Smart meeting

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

User-specified: Next.js 16 App Router, TypeScript, Tailwind CSS. Supabase is the intended future backend. This phase is a local UI project with synthetic data, no Supabase connection, no authentication service and no deployment.

## Users

The user explicitly selected the secretary as the primary home-screen audience. The secretary records resolutions, assigns owners, follows overdue work, prepares the next meeting, and coordinates review. Other PRD roles are task owners, reviewers, executives, unit heads and administrators. UI role switching is a demonstration, not authorization.

## Product Purpose

Turn meeting resolutions into accountable work: who does what, by when, with which evidence, and who accepts the result. Preserve a clear distinction between progress, submission, review, and resolution closure.

## Operating Context

Thai-language university administration, Faculty of Political Science, Ubon Ratchathani University as proposed in PRD.md. The user requested implementation against that PRD. Meeting → agenda → resolution → tasks → evidence → review → closure. Frequent desktop use and mobile follow-up.

## Capabilities and Constraints

UI first. Cover the PRD's primary screens with realistic synthetic records, useful filtering, forms and interactive workflow demonstrations. Store demonstration changes in the browser where feasible. Original deadlines are preserved. 100% progress does not close work. Closure requires accepted required tasks. Calendar and dates use Asia/Bangkok and Thai Buddhist-year display. Institutional powers, actual retention policies, SSO and integrations remain open decisions in PRD.md.

## Brand Commitments

Name: POLUBU Smart meeting, as used in the PRD. Thai-first, clear and professional wording. No official logo, colors or approved visual identity supplied; do not fabricate a university seal.

## Evidence on Hand

PRD.md is the specification. No existing application or design assets. All people, documents, statistics and operational records in the prototype must be labeled synthetic.

## Product Principles

- Put the next action in front of the secretary.
- Make original and current deadlines visible together.
- Separate work delivery from review and acceptance.
- Show the provenance of every decision.
- Never imply mock permissions or local storage provide production security.

## Accessibility & Inclusion

Thai-readable type, keyboard-operated controls, visible focus, status labels in addition to colors, responsive layouts, accessible dialogs and empty/error states. PRD proposes WCAG 2.2 AA as a target; no compliance claim is made.
