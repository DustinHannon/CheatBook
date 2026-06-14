# CheatBook — Authentication setup

CheatBook uses **Microsoft Entra ID (Azure AD) SSO** as the primary sign-in, with a
**break-glass** username/password account for emergencies. Identity/session and
row-level-security are brokered by Supabase Auth (it issues the JWT that RLS uses).

## 1. Break-glass account (works today)
A break-glass account is already provisioned in Supabase Auth, pre-approved, and flagged
as an admin (`profiles.approved = true`, `profiles.is_admin = true`). On the login screen,
open **"Use a break-glass account"** and sign in:

- **Username:** `breakglass-admin`  (the app maps this to `breakglass-admin@cheatbook.local`)
- **Password:** _(provided privately — not stored in the repo)_

Break-glass sign-ins are intended for when Entra is unavailable. To add more or rotate
the password, manage the user in the Supabase dashboard (Authentication → Users).

## 2. Microsoft Entra ID SSO (you finish this — needs your tenant)
Entra SSO is wired but **gated** behind `NEXT_PUBLIC_ENTRA_ENABLED` because it requires a
tenant app registration secret that can't be self-provisioned. Steps:

1. **Azure portal → Entra ID → App registrations → New registration.**
   - Name: `CheatBook`. Supported account types: *Accounts in this organizational directory only* (MorganWhiteGroup single tenant).
   - Redirect URI (Web): `https://ccthpkbljqxwtugawcyc.supabase.co/auth/v1/callback`.
2. Copy the **Application (client) ID** and the **Directory (tenant) ID**.
3. **Certificates & secrets → New client secret.** Copy the secret **Value**.
4. **API permissions:** Microsoft Graph → delegated `email`, `openid`, `profile`, `User.Read` → Grant admin consent. (`User.Read` is also what lets CheatBook sync each user's Microsoft 365 profile photo into their avatar on sign-in.)
5. **Supabase dashboard → Authentication → Providers → Azure:** enable it; paste Client ID, Client Secret, and set the **Azure Tenant URL** to `https://login.microsoftonline.com/<your-tenant-id>`.
6. **Supabase → Authentication → URL Configuration:** add `https://thecheatbook.vercel.app` (and `http://localhost:3000` for dev) to redirect URLs; Site URL = the Vercel prod URL.
7. **Vercel → Project → Settings → Environment Variables:** add `NEXT_PUBLIC_ENTRA_ENABLED=true` and redeploy.

Once enabled, the white **"Sign in with Microsoft Entra ID"** button starts the real
redirect flow. New users land in a **pending** state (`profiles.approved = false`) and must
be approved by an admin in **Settings → Users** before they can see any content. On each
Entra sign-in their Microsoft 365 profile photo is synced into their avatar automatically
(unless they've uploaded their own in Settings).

## Environment variables
| Var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (already set) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (already set) |
| `NEXT_PUBLIC_ENTRA_ENABLED` | `true` to light up the Entra SSO button (default off) |
