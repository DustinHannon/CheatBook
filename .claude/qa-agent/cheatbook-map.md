# CheatBook map — routes, labels, data model, teardown (for the QA agent)

Best-effort reference. **Always confirm what's actually on screen** — the UI may have shifted.

## Environment & auth
- **URL:** `https://cheatbook.morganwhite.com`
- **Auth:** email + password (Supabase Auth, email confirmation). Credentials live in
  `.claude/qa-agent/credentials.local.json` (gitignored). Never echo the password.
- **Supabase project (teardown only):** `ccthpkbljqxwtugawcyc`.

## Routes
| Route | What's there |
|-------|--------------|
| `/login` | Split-screen sign in / sign up (`components/Authentication.tsx`). Errors render in a red box. |
| `/team-setup` | Create-or-join-team (post-signup, or if no team). Already-teamed users are bounced to `/`. |
| `/` | Dashboard: greeting + team name, **Pinned** row (if any), **Recent notes** grid, **Activity feed**, empty/error states, header **"New Note"** button. |
| `/notes/[id]` | TinyMCE editor + top bar (connection dot, save status, presence avatars, `…` menu). |
| `/notebooks/[id]` | Notebook's note cards + **"New Note"**. |
| `/search` | Full-page search; result cards open `/notes/[id]`. |
| `/profile` | Settings: avatar, name, read-only email, **Team** card (name, members, invite code copy, role pills, invite). |

## Key controls / labels
- **Sidebar** (`components/NotesList.tsx`): header has a **New note** (`DocumentPlus` icon) and
  **New notebook** (`FolderPlus` icon) button. Collapsible sections: **Recent Notes**,
  **Notebooks** (each expands to its notes + a per-notebook **"Add note"**), **Uncategorized**.
- **Top bar** (`components/NavBar.tsx`): search trigger opens the command palette; user menu → Sign out.
- **Command palette** (`Cmd/Ctrl+K`): search input, ↑/↓ to move, **Enter** opens, **Esc** closes.
- **Editor** (`components/NoteEditor.tsx`): title input, TinyMCE body. Toolbar: bold, italic,
  underline, strikethrough, blocks (Paragraph/H1/H2/H3/Code), bullist, numlist, blockquote,
  **codesample**, link, image, table, hr, removeformat. Save status reads
  Saved / Saving… / Unsaved / Error. **Ctrl/Cmd+S** saves now. Auto-saves ~2s after typing stops.
- **`…` note menu:** Share (if wired), Duplicate, **Pin/Unpin note**, **Lock/Unlock note**,
  **Hide note**, **Delete** (red). Locked note shows a banner + **"Edit anyway"**.
- **Dialogs:** create-notebook = `InputDialog`; notebook chooser = `NotebookPickerDialog`;
  confirms = `ConfirmDialog`. All: Esc closes, backdrop click closes, `role="dialog"`/`aria-modal`.
- **Toasts** (`components/Toast.tsx`): bottom-right, auto-dismiss ~3s; success/error/info.

## Quick-create logic (dashboard)
`handleNewNoteClick(notebookId?)`: explicit notebook → create there; else 0 notebooks → open
create-notebook dialog; exactly 1 → create in it; 2+ → open the notebook picker.

## Data model (for teardown)
Tables (all team-scoped via RLS): `profiles`, `teams`, `team_members`, `notebooks`, `notes`,
`images`, `hidden_notes`, `categories`, `note_categories`, `activity_log`, `collaborators`.
- `notes.notebook_id → notebooks(id)` **ON DELETE CASCADE**.
- `images.note_id`, `hidden_notes.note_id`, `note_categories.note_id` → **CASCADE**.
- So **deleting a notebook deletes its notes, and each note's images/hidden/category rows.**
- `activity_log.target_id` is a bare uuid (no FK) — orphan rows are harmless but can be cleaned.
- Image files live in the `images` storage bucket under `<userId>/<noteId>/<ts>.<ext>`.

## Teardown SQL (run via the Supabase MCP `execute_sql`, project `ccthpkbljqxwtugawcyc`)
Substitute `:runtag` with this run's tag (e.g. `QA-20260611_2130`). Scoped to the run tag AND
your recorded ids, so it can never touch real data. Run in this order:

```sql
-- 0) (optional) clean activity_log rows this run generated for test targets
delete from activity_log
where target_title like 'QA-%' and target_title like :runtag || '%';

-- 1) remove storage image rows for notes in this run's test notebooks
--    (cascade from notebook delete handles the public.images table rows;
--     this clears the storage objects so no orphaned files remain)
delete from storage.objects
where bucket_id = 'images'
  and (storage.foldername(name))[2] in (
    select id::text from notes
    where notebook_id in (select id from notebooks where title like :runtag || '%')
  );

-- 2) delete the run's test notebooks → cascades notes → images/hidden_notes/note_categories
delete from notebooks where title like :runtag || '%';

-- 3) defensively delete any stray test notes created outside a test notebook
delete from notes where title like :runtag || '%';

-- 4) VERIFY — must return 0
select
  (select count(*) from notebooks where title like :runtag || '%') as notebooks_left,
  (select count(*) from notes     where title like :runtag || '%') as notes_left;
```

Prefer the recorded ids from `changes.jsonl` when available (delete `where id = any(array[...])`),
and use the `:runtag` LIKE clauses as the safety net. If any DELETE is denied, report the exact
ids still needing cleanup in the teardown note and set `testRowsRemaining` to the verify count.

## Guardrail reminders (also in the command)
- Real notes/notebooks/members/profile = **read-only**. Only mutate `QA-<runtag>` data you made.
- Team invite/remove/role and profile Save are **NOT** to be committed (affordance QA only).
- The agent drives the **browser** for all feature exercise; Supabase MCP is teardown-only.
