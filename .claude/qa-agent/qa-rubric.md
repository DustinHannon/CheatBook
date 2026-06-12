# QA Rubric — what to look for (CheatBook QA agent)

Check every screen/flow against these. Each item is a discrete observation you can
answer yes/no. When something fails (or is notably good), log a finding per the schema
in the command file. Research-backed (NN/g heuristics, Whittaker tours, WCAG 2.2,
Baymard, web.dev Core Web Vitals, standard QA severity conventions).

## A. Nielsen's 10 usability heuristics (one-line checks)
1. **System status** — does the UI always show what's happening (loading, saving/saved,
   presence, typing) with feedback within ~1s?
2. **Match the real world** — plain user language, natural order, no internal jargon?
3. **User control & freedom** — a clearly marked cancel/back/undo from any state?
4. **Consistency & standards** — same word/icon/action means the same thing everywhere;
   follows web conventions (Cmd+K, Ctrl+S, Esc to close)?
5. **Error prevention** — error-prone conditions blocked up front (locked-note guard,
   confirms on destructive actions, good defaults)?
6. **Recognition over recall** — needed info/options visible, not memorized?
7. **Flexibility & efficiency** — accelerators (keyboard shortcuts, quick-create) that
   don't block novices?
8. **Aesthetic & minimalist** — no clutter competing with the primary task (writing)?
9. **Error recovery** — messages name the problem AND a concrete fix, in plain language?
10. **Help** — contextual, concise help where needed (empty states, first-run)?

## B. Exploratory tours (Whittaker) — run the ones that fit each screen
- **Feature/Landmark** — hit each major feature → broken/missing core function.
- **FedEx (data-trace)** — follow ONE note create→edit→save→reopen→search→preview →
  data-integrity bugs (content lost, preview wrong, search stale).
- **Antisocial/saboteur** — paste HTML/script-looking strings into the editor and the
  search box; submit empty/invalid; do steps out of order → XSS, crashes, sequence bugs.
- **Configuration** — vary viewport (375/768/1440), and (if safe) signed-out vs in →
  responsive/auth-guard bugs.
- **Obsessive/repeat** — repeat an action, double-click "New Note"/Save, rapid Cmd+K →
  duplicates, double-submit, state corruption.
- **Couch-potato** — click through accepting all defaults → bad defaults, required gaps.
- **Garbage-collector** — sweep every page/element methodically → cosmetic/label defects.
- **Guidebook** — follow tooltips/placeholders literally → behavior contradicting them.
- **Prior-version/museum** — re-test the areas just fixed (see §M) → regressions.

## C. Forms & data entry (login, create-notebook, create-note, note title, search, profile)
- Field order matches mental model; related fields grouped.
- Logical tab order follows visual order; no keyboard traps.
- Persistent, clear labels (not placeholder-as-label).
- Inline validation at the right time (on blur / after a real attempt), not every keystroke.
- Specific, constructive error messages next to the offending field (not "Invalid input").
- Sensible defaults / format tolerance.
- Enter/keyboard submits; primary action reachable without mouse.
- Focus management — focus jumps to first error on failed submit; dialogs trap & restore focus.
- No data loss on validation error, back-nav, or timeout (esp. the auto-saving editor).
- Disabled-submit clarity — if disabled, it's obvious why.

## D. Accessibility (pragmatic WCAG 2.2)
- Contrast ≥ 4.5:1 text / 3:1 large text & UI components (watch the gold accent on dark).
- Visible focus ring on every interactive element.
- Keyboard-only operates the whole flow; no mouse-only actions; no focus traps.
- Alt text meaningful on content images; avatars have names.
- Semantic headings/landmarks; real `<button>`/`<a>` not clickable `<div>`s.
- Labels/names on every input and icon-only button (the `…` menu, copy-code, avatar).
- Dialogs: `role="dialog"`, `aria-modal`, labelled by title, focus trap, Esc to close.
- Target size ≥ 24×24px with spacing.
- Zoom/reflow usable at 200% / ~320px width without clipping or horizontal scroll.

## E. Performance & perceived latency
- Any action > ~1s shows spinner/skeleton; long ops show progress, never a frozen UI.
- Skeletons reserve correct space (no layout shift; CLS ≤ 0.1).
- No blocking UI — can still read/scroll during background work.
- Button/toggle/nav feedback < ~100ms even if the result is pending.
- Note anything that "feels slow": janky scroll, laggy typing in the editor, slow route
  transitions, repeated refetches, the realtime channel reconnect.

## F. Console & network (pull on every screen)
- Zero uncaught JS errors (TypeError/ReferenceError…).
- No unhandled promise rejections (`Uncaught (in promise)`).
- Note warnings/deprecations, CSP/mixed-content, React key / **hydration** warnings.
- Flag any 4xx/5xx request and failed asset (img/css/js/font), including Supabase REST
  (`/rest/v1/…`) and realtime (`/realtime/v1/…`) calls.
- Excessive/duplicate requests, polling storms, a call on every keystroke, N+1.

## G. Visual & layout
- Overflow/clipping; truncation without ellipsis/tooltip.
- Misalignment; inconsistent padding/margins on similar elements.
- z-index/overlap (command palette, the `…` note menu, dialogs, toasts, sidebar overlay).
- Responsive breakpoints (320/375/768/1024/1440): no horizontal scroll; sidebar collapses
  to the hamburger/off-canvas on mobile.
- Typography consistency (display / body / mono fonts); correct hover/active/disabled/selected.
- Long-content robustness — long titles, big code blocks, empty/zero, many notebooks/notes.

## H. Information architecture & flow
- Findability — can a first-timer find "create a note" without guessing?
- Step economy — count clicks for the core task (new note → type → it's saved); flag bloat.
- Clear next action — every screen makes the obvious next step visually primary.
- No dead ends — search results, empty states, and detail pages always offer a forward path.
- Consistent terminology — same concept = same word across nav, buttons, headings.
- Wayfinding — current location obvious (active sidebar item, title); back behaves; deep
  links (`/notes/[id]`, `/notebooks/[id]`) land correctly.

## I. Error & edge states
- Empty states explain why empty + what to do (no notes, no notebooks, no search results).
- Error states show a human message + recovery path, not a blank/stack (dashboard load error).
- Destructive-action safety — delete note, remove member, lock override confirm/are reversible.
- Double-submit/idempotency — rapid double-click doesn't duplicate a note/notebook.
- Invalid input handled gracefully, never a crash or silent swallow.
- Interrupted flows (refresh mid-edit, back, navigate away within the 2s autosave window)
  degrade gracefully — edits are not lost.
- Success confirmation (toast) on high-impact actions (delete, hide, role change, invite).

## J. Real end-user complaint lens (+ "this would be faster if…")
Reframe friction as a user gripe and append the concrete redesign:
- "I don't know if it saved" → missing save feedback.
- "It lost what I typed" → no persistence on nav within the debounce window.
- "I didn't mean to delete that" → missing undo/confirm.
- "Why won't this button work?" → silently disabled / unexplained.
- "I searched and clicking did nothing useful" → broken result nav.
- "It looks broken on my phone" → responsive failure.
- "The error didn't tell me what to fix" → cryptic message.
For each, propose the fix (let Enter submit, default a field, add a toast, surface progress…).

## K. Severity (tag every finding) = impact
- **Blocker** — crash/hang or the flow can't proceed at all.
- **Critical** — core function broken (can't create/save/open a note, data loss, XSS), no workaround.
- **Major** — significant impairment but a workaround exists, or fails only in specific conditions.
- **Minor** — annoying glitch that doesn't stop task completion.
- **Cosmetic** — visual/typo, no functional impact.
- **UX-suggestion** — not a defect; a speed/clarity/flow improvement ("would be faster if…").
- **Positive** — works well / feels fast (record these too; the report shows both sides).

## L. Anatomy of a good finding (maps to findings.jsonl)
`title` (`[Severity] what, where`) · `location` (url/route/viewport) · `steps` (minimal,
deterministic) · `expected` vs `actual` · `evidence` (screenshot + console/network) ·
`frequency` · `userComplaint` + `suggestion`. A developer should be able to reproduce it
without asking you anything.

## M. CheatBook feature checks (discrete yes/no) — see `cheatbook-map.md` for routes/labels
**Auth & team**
- Login/signup: split-screen auth renders; bad email / empty submit gives a clear message;
  Enter submits; after sign-in you land on the dashboard (or `/team-setup` if no team).
- Already on a team → visiting `/team-setup` bounces you back to the dashboard (no re-create).

**Notes & editor (the heart of the app)**
- Create note (header "New Note" / sidebar +): with 0 notebooks it prompts to create one;
  with exactly 1 it creates the note there; with 2+ it shows the notebook picker.
- Sidebar per-notebook "Add note" creates the note in THAT notebook (not the picker/first one).
- TinyMCE editor loads (self-hosted; no license nag); toolbar = bold/italic/underline/
  strikethrough, headings (blocks), lists, blockquote, code sample, link, image, table, hr,
  clear formatting. Type a paragraph — **typing is not laggy and the cursor doesn't jump/reverse**.
- **Auto-save:** after ~2s of no typing the status flips to "Saved"; navigating away
  immediately after typing still persists the edit (reopen the note to confirm — no loss).
- **Ctrl/Cmd+S** saves immediately.
- **Paste an image** into the editor body (clipboard) — it uploads and the `<img>` appears
  inline at the cursor and survives a reload (this was previously broken — give it scrutiny).
- Insert a code block (code sample) with a language; it renders monospaced.
- **Note menu (`…`):** Pin / Unpin (pinned notes show a PINNED row on the dashboard and a pin
  marker on cards), Lock / Unlock (locked note shows the banner + "Edit anyway"; editing is
  blocked until override), Hide (note disappears for you, toast confirms), Duplicate, Delete
  (toast confirms; returns to dashboard).
- Note metadata header shows "Created by …" and "Edited by … <relative time>".
- Legacy/edge content: a note renders without breaking; preview text on cards strips HTML.

**Real-time collaboration** (best-effort solo; open the same note in a 2nd tab if time allows)
- Presence avatars appear for users on the note; an active dot shows (should NOT grey out a
  still-connected user after 60s).
- Typing indicator appears for the other tab and clears when they stop (not stuck on).
- Editing in tab A appears in tab B without clobbering tab B's in-progress edits.

**Dashboard & navigation**
- Greeting + team name; Recent notes grid; Pinned row (if any pinned); Activity feed.
- Dashboard loading resolves (no infinite skeletons), and a load error shows an error +
  Retry (not a false "Welcome/empty" state).
- **Cmd/Ctrl+K** opens the command palette; type to search (debounced); ↑/↓ + Enter open a
  note; Esc closes; rapid typing doesn't show stale results.
- **Full-page `/search`:** results render; **clicking a result opens that note** (`/notes/[id]`),
  not the dashboard (this was previously broken — verify).
- Sidebar shows notebooks + recent notes; on a note/notebook page the sidebar still lists the
  FULL set of team notes (not just the open notebook's). Collapses to hamburger on mobile.

**Settings / profile / team management**
- Profile: name field, avatar, read-only email. (QA the form; the agent does NOT save real
  profile changes — see the command's guardrails.)
- Team card: name, member count, invite code with a copy button (copies; "Copied!" shows).
- Members list with role pills. (Role toggle / remove / invite are admin-only and DESTRUCTIVE
  to real team data — the agent must NOT commit them; QA the affordances/disabled states and
  any clear error only, per the command guardrails.)

**Security smell-tests (read-only, never destructive)**
- Paste `<img src=x onerror="…">` / `<script>…` into a note, save, reopen — confirm it does
  NOT execute (stored-HTML XSS surface). Log a Critical if any injected script runs.
- Type a comma / quote / parenthesis into search — results return sanely, no 400, no console
  error (search-filter robustness).

### Judge the UI of every surface
Are the screens clear, well-placed, consistent with the dark editorial design system, and
free of console errors? Record UX-suggestions for anything that "would be clearer/faster
if…" — the user wants improvement ideas, not just defects.
