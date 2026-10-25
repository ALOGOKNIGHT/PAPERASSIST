# Connect PaperCraft to Supabase Auth

The login and create-account forms use Supabase Auth email/password. The browser client is loaded from the Supabase JS v2 CDN in `index.html`; configure the public project values before using the forms.

## Configure the project

1. In Supabase, open **Project Settings → API** and copy the **Project URL** and **publishable key** (the older `anon` key is also accepted by Supabase).
2. Paste them into `data/supabase-config.js` as `url` and `publishableKey`.
3. In **Authentication → URL Configuration**, set the Site URL to the deployed PaperCraft URL. Add the local development URL to Redirect URLs, for example `http://localhost:8000/**`.
4. Enable email/password sign-in in **Authentication → Sign In / Providers**. Email confirmation is handled by the UI: with confirmation enabled, signup asks the user to check their inbox; without confirmation, it opens the studio immediately.
5. Serve the app from an HTTP origin such as `http://localhost:8000` or your hosted domain. Avoid opening `index.html` as a `file://` URL because Supabase Auth redirects and browser storage require a normal site origin.

For a quick local static server with Python installed, run `python -m http.server 8000` from this project folder and open `http://localhost:8000`.

The publishable/anon key is intended for browser use; never place a Supabase secret or service-role key in `data/supabase-config.js`. Database access is not implemented by this landing-page auth change. If PaperCraft later stores user-owned papers in Supabase, enable Row Level Security and add policies that scope rows to `auth.uid()`.

## What the app does

- Create accounts with `auth.signUp({ email, password })`.
- Sign in with `auth.signInWithPassword({ email, password })`.
- Restore the Supabase session on page load and show the account email in the studio profile.
- Sign out with `auth.signOut()`.
- Keep the paper studio accessible as a guest; sign-in does not gate the builder yet.
