# Supabase Setup

## 1. Replace the exposed key

The previous browser configuration contained a `service_role` key. Rotate that key in Supabase immediately. Never put a `service_role` or secret key in a `VITE_*` variable; Vite ships those values to every browser.

In Project Settings → API, copy the Project URL and the public `anon` key (or a `sb_publishable_` key). You can enter these on the app's **Database Setup** screen; it saves them only in that browser and reloads the app. For deployments, configure the same values as environment variables:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

Do not add `/rest/v1/` to the URL. Restart the Vite server after editing the file. The browser client rejects JWT keys whose role is `service_role`.

## 2. Apply the database schema

Open Supabase Dashboard → SQL Editor, run the complete `supabase/schema.sql`, then check that the new `account_profiles` table and the inventory/data tables exist. The script removes the old anonymous prototype policies and enables Supabase Auth-based access.

## 3. Configure Auth

In Authentication → URL Configuration:

- Set the Site URL to your development or production app URL.
- Add your app's local and production URLs to the allowed site/redirect list.
- Keep email confirmation enabled so sign-up and password reset require control of the account email.

In Authentication → Email Templates → Reset Password, include the OTP variable `{{ .Token }}` in the message. The app asks the user to enter that code, verifies it with Supabase Auth, and only then shows the new-password form. Set a short OTP expiry in Auth settings.

New accounts are created by Supabase Auth. The account profile trigger assigns only `staff`, `fuel-vehicle`, or `warehouse` to public registrations.

## 4. Provision administrators

Create the administrator account in Authentication → Users (or register it first as a regular user). Then assign its role from SQL Editor:

```sql
update public.account_profiles
set role = 'super-admin'
where email = 'admin@your-domain.gov.ph';
```

Use `admin` instead of `super-admin` for a regular administrator. Do not expose administrator role assignment in the public app.

## 5. Existing browser data

When a signed-in user first opens an empty database, the app attempts to seed its local cache. Staff records are limited to that username; the super-admin can migrate all cached data on that browser. Legacy local accounts and password hashes cannot be imported as Supabase Auth credentials. Users must create/confirm Auth accounts, and administrators must be provisioned as described above.
