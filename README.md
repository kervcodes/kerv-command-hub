# Kerv Command Hub — Personal Command Center Dashboard

A single-user personal dashboard built with **Next.js 16** and **Appwrite** (cloud BaaS). It lets you organise bookmarks across panels, import Chrome bookmarks in bulk, and manage a PDF library — all behind email/password authentication.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Data Model](#data-model)
5. [Authentication Flow](#authentication-flow)
6. [Key Features](#key-features)
7. [Getting Started](#getting-started)
8. [Environment Variables](#environment-variables)
9. [Available Scripts](#available-scripts)
10. [File-by-File Reference](#file-by-file-reference)
11. [Deployment](#deployment)
12. [Common Tasks & Recipes](#common-tasks--recipes)
13. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────┐        ┌────────────────────┐        ┌──────────────────┐
│   Browser   │◄──────►│   Next.js App      │◄──────►│   Appwrite Cloud │
│  (React 19) │  HTTP  │  (App Router, RSC) │  SDK   │  (Database,      │
│             │        │                    │        │   Storage, Auth) │
└─────────────┘        └────────────────────┘        └──────────────────┘
```

- **Frontend**: React 19 client components with drag-and-drop (`@hello-pangea/dnd`), Tailwind CSS v4, `next-themes` dark mode.
- **Backend**: Next.js Server Actions (the `'use server'` functions in `actions.ts` / `auth-actions.ts`), plus one API route for PDF streaming.
- **Data layer**: Appwrite Databases (3 collections) and Appwrite Storage (1 bucket for PDFs).
- **Auth**: Appwrite email/password sessions, stored in an `httpOnly` cookie and checked by Next.js middleware.

There is **no separate API server** — the Next.js server calls Appwrite directly using the `node-appwrite` SDK.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.x |
| UI library | React | 19.x |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| Dark mode | next-themes | 0.4.x |
| Drag & drop | @hello-pangea/dnd | 18.x |
| Icons | lucide-react | 0.575.x |
| Backend-as-a-Service | Appwrite (cloud) | — |
| Appwrite SDK | node-appwrite | 22.x |

---

## Project Structure

```
opsdashboardcmd/
├── .env.local.example       # Template for environment variables
├── .env.local               # ← Your actual secrets (git-ignored)
├── next.config.ts           # Next.js config (48 MB server action limit, aligned to Appwrite bucket max)
├── tsconfig.json            # TypeScript config, path alias @/* → ./src/*
├── package.json             # Dependencies & scripts
├── postcss.config.mjs       # PostCSS → Tailwind
├── eslint.config.mjs        # ESLint rules
│
├── scripts/
│   └── setup-appwrite.ts    # One-time script: creates DB, collections, indexes, bucket
│
├── public/                  # Static assets
│
└── src/
    ├── middleware.ts         # Auth guard — redirects unauthenticated users to /login
    │
    ├── lib/
    │   └── appwrite.ts      # Appwrite client factories + helper utilities
    │
    ├── app/
    │   ├── layout.tsx        # Root layout (fonts, ThemeProvider)
    │   ├── globals.css       # Tailwind imports + custom CSS variables (light/dark)
    │   ├── page.tsx          # Home page (server component, fetches data, renders Dashboard)
    │   ├── actions.ts        # Server Actions: CRUD for categories, links, library items
    │   ├── auth-actions.ts   # Server Actions: signIn, signOut, getLoggedInUser
    │   │
    │   ├── login/
    │   │   └── page.tsx      # Login form (client component)
    │   │
    │   └── api/
    │       └── file/
    │           └── route.ts  # GET endpoint — streams a PDF from Appwrite Storage
    │
    └── components/
        ├── Dashboard.tsx     # Main dashboard UI (panels, categories, links, library)
        ├── ThemeProvider.tsx  # Wraps next-themes provider
        └── ThemeToggle.tsx   # Light / System / Dark toggle buttons
```

---

## Data Model

All data lives in an Appwrite Database called **`ops-dashboard`** with three collections:

### `categories` Collection

| Attribute | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | string(255) | ✓ | — | Display name of the category |
| `panel` | string(255) | ✓ | `"Work"` | Which panel/tab this category belongs to |
| `order` | integer | ✓ | `0` | Sort position within its panel |

**Indexes**: composite index on `(panel, order)` ascending.

### `links` Collection

| Attribute | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | string(255) | ✓ | — | Display name of the link |
| `url` | string(2048) | ✓ | — | Target URL |
| `description` | string(1024) | ✗ | `""` | Optional short description |
| `order` | integer | ✓ | `0` | Sort position within its category |
| `source` | string(50) | ✓ | `"manual"` | Origin: `"manual"` or `"chrome"` |
| `categoryId` | string(36) | ✓ | — | Foreign key → `categories.$id` |

**Indexes**: composite on `(categoryId, order)` ascending. (No unique index on `url` — it exceeds Appwrite's max index size. Uniqueness is handled at the application level.)

> **Note**: Appwrite has no CASCADE delete. When a category is deleted, the server action manually deletes all its child links first.

### `library-items` Collection

| Attribute | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | string(500) | ✓ | — | PDF display name (filename without `.pdf`) |
| `fileId` | string(36) | ✓ | — | References a file in the `pdfs` Storage bucket |
| `folder` | string(255) | ✓ | `"Uploads"` | Virtual folder grouping |
| `order` | integer | ✓ | `0` | Sort position within its folder |
| `folderOrder` | integer | ✓ | `0` | Sort position of the folder itself |

**Indexes**: composite on `(folderOrder, order)` ascending; unique on `fileId`.

### `pdfs` Storage Bucket

- **Allowed extensions**: `pdf`
- **Max file size**: 50,000,000 bytes (approx 47.6 MiB)
- **Compression**: gzip
- **Permissions**: Read by anyone (the PDF viewer URL is only exposed to authenticated users via the API route)

---

## Authentication Flow

```
1. User visits any page
2. middleware.ts checks for `appwrite-session` cookie
   ├─ Missing → redirect to /login
   └─ Present → allow through

3. User can either:
   a) /login → enter email + password
   b) /signup → enter email + password + access code

4. signIn() or signUp() server action:
   ├─ signIn: Calls Appwrite account.createEmailPasswordSession()
   ├─ signUp: Validates access code, creates user, then creates session
   ├─ Sets httpOnly cookie `appwrite-session` = session.secret
   └─ Redirects to /

5. page.tsx (home): getLoggedInUser() double-checks session validity
   ├─ Invalid → redirect to /login
   └─ Valid → fetch data, render Dashboard

6. Sign out: deletes Appwrite session + clears cookie → redirect /login
```

### Key details

- The session cookie is `httpOnly`, `secure` in production, `sameSite: strict`, expires in 30 days.
- The middleware only checks for cookie **existence** (fast). The `page.tsx` server component validates the session with Appwrite to handle expired/revoked sessions.
- The `/api/file` route also checks for the session cookie before serving PDFs.
- Signup requires a valid access code (configured in `NEXT_PUBLIC_SIGNUP_ACCESS_CODES` env var).

### User Registration

There are two ways to create a user account:

**Option 1: Sign up via the app** (recommended for self-service)
1. Go to [http://localhost:3000/signup](http://localhost:3000/signup)
2. Enter your email, password, and a valid access code
3. Click "Sign Up"
4. You'll be logged in automatically

**Option 2: Create in Appwrite Console** (for admin/setup)
1. Go to [Appwrite Console](https://cloud.appwrite.io/) → your project → **Auth** → **Users**
2. Click **Create User**
3. Enter email and password
4. Sign in at [http://localhost:3000/login](http://localhost:3000/login)

### Access Codes

Access codes are comma-separated strings stored in the `NEXT_PUBLIC_SIGNUP_ACCESS_CODES` environment variable. You can have multiple codes:

```dotenv
NEXT_PUBLIC_SIGNUP_ACCESS_CODES=welcome123,beta-tester,admin-setup
```

Each signup attempt must provide one of these codes. Codes are reusable (not one-time use) — change them in `.env.local` to revoke old codes.

---

## Key Features

### Panels & Categories

- **Panels** are virtual tabs (e.g. "Work", "Personal"). They're derived from the `panel` field on categories.
- Create a new panel by clicking "Add panel" in the sidebar and typing a name.
- Delete a panel (and all its categories/links) via the ✕ button next to the active panel.
- **Categories** are groups of links within a panel.
- Both categories and links support **drag-and-drop reordering** (cross-category link moves are supported).

### Bookmark Import

- Click "Import Bookmarks" in the sidebar footer.
- Select a Chrome HTML bookmark export file.
- The parser maps top-level bookmark folders → panels, sub-folders → categories.
- Duplicate URLs are upserted (updated in place, not duplicated).

### PDF Library

- Switch to the 📚 Library panel.
- **Upload PDFs** via the file picker (multi-select supported). Assign them to a virtual folder.
- PDFs are stored in Appwrite Storage. The metadata (name, folder, order) is stored in the `library-items` collection.
- Click a PDF name to view it in an embedded viewer (iframe). The viewer supports fullscreen toggle.
- Drag-and-drop reorders both folders and items within folders.

### Theme Support

Three modes: Light, System, Dark — toggled via the sidebar control. Powered by `next-themes` with the `class` strategy and custom CSS variables.

### Keyboard Shortcuts

- Press `1`–`9` to switch panels (when no input is focused).
- Press `Escape` to close the PDF viewer.

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** (or pnpm/yarn — adjust commands accordingly)
- An **Appwrite Cloud** account (free tier works), or a self-hosted Appwrite instance

### 1. Clone & install

```bash
git clone <repo-url>
cd opsdashboardcmd
npm install
```

### 2. Create an Appwrite project

1. Go to [cloud.appwrite.io](https://cloud.appwrite.io/) and create a new project.
2. Go to **Settings** → Copy the **Project ID**.
3. Go to **API Keys** → Create a new API key with these scopes:
   - `databases.read`, `databases.write`
   - `collections.read`, `collections.write`
   - `documents.read`, `documents.write`
   - `files.read`, `files.write`
   - `buckets.read`, `buckets.write`
   - `users.read`, `users.write`

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in:

```dotenv
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=<your-project-id>
NEXT_PUBLIC_APPWRITE_API_KEY=<your-api-key>
```

### 4. Run the setup script

This creates the database, all three collections with their attributes/indexes, and the storage bucket:

```bash
npm run setup-appwrite
```

The script will print the collection and bucket IDs. They should match the defaults in `.env.local.example` — verify and add them to your `.env.local`:

```dotenv
NEXT_PUBLIC_APPWRITE_DATABASE_ID=ops-dashboard
NEXT_PUBLIC_APPWRITE_CATEGORIES_COLLECTION_ID=categories
NEXT_PUBLIC_APPWRITE_LINKS_COLLECTION_ID=links
NEXT_PUBLIC_APPWRITE_LIBRARY_COLLECTION_ID=library-items
NEXT_PUBLIC_APPWRITE_PDF_BUCKET_ID=pdfs
```

### 5. Create a user account

In the Appwrite Console, go to **Auth** → **Users** → **Create User** and enter your email/password.

### 6. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in, and you're set.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | ✓ | Appwrite API endpoint (e.g. `https://cloud.appwrite.io/v1`) |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | ✓ | Your Appwrite project ID |
| `NEXT_PUBLIC_APPWRITE_API_KEY` | ✓ | API key (used server-side only despite the prefix) |
| `NEXT_PUBLIC_APPWRITE_DATABASE_ID` | ✓ | Database ID (default: `ops-dashboard`) |
| `NEXT_PUBLIC_APPWRITE_CATEGORIES_COLLECTION_ID` | ✓ | Collection ID (default: `categories`) |
| `NEXT_PUBLIC_APPWRITE_LINKS_COLLECTION_ID` | ✓ | Collection ID (default: `links`) |
| `NEXT_PUBLIC_APPWRITE_LIBRARY_COLLECTION_ID` | ✓ | Collection ID (default: `library-items`) |
| `NEXT_PUBLIC_APPWRITE_PDF_BUCKET_ID` | ✓ | Storage bucket ID (default: `pdfs`) |

All variables use the `NEXT_PUBLIC_` prefix. The API key is only used in server actions and API routes (never in client components), so it remains safe despite the prefix.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js dev server (with Turbopack) |
| `npm run build` | Create an optimised production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run setup-appwrite` | One-time: provision Appwrite database, collections & bucket |

---

## File-by-File Reference

### `src/lib/appwrite.ts`

Central Appwrite configuration. Exports:

| Export | Description |
|---|---|
| `createAdminClient()` | Returns `{ account, databases, storage }` using the API key. Used in server actions. |
| `createSessionClient(secret)` | Returns `{ account }` using a user session. Used to validate user identity. |
| `listAll(databases, dbId, colId, queries)` | Pagination helper — fetches all documents from a collection (100 per page). |
| `AppDocument` | TypeScript type for Appwrite documents with custom fields (`Models.Document & Record<string, unknown>`). |
| `DATABASE_ID`, `*_COLLECTION_ID`, `PDF_BUCKET_ID` | Constants loaded from env vars. |
| `ID`, `Query` | Re-exported from `node-appwrite` for convenience. |

### `src/app/actions.ts`

All data mutation and querying logic as Next.js Server Actions. Functions:

| Function | Signature | Description |
|---|---|---|
| `getCategories()` | `→ Category[]` | Fetch all categories with their nested links |
| `createCategory(formData)` | `→ void` | Create a category in a panel |
| `deleteCategory(id)` | `→ void` | Delete a category and all its links |
| `deletePanel(panelName)` | `→ void` | Delete all categories/links in a panel |
| `createLink(formData)` | `→ void` | Add a link to a category |
| `updateLink(formData)` | `→ void` | Edit a link's name, URL, description, or category |
| `deleteLink(id)` | `→ void` | Delete a link |
| `updateCategoryOrder(updates)` | `→ void` | Batch-update category sort order |
| `updateLinkOrder(updates)` | `→ void` | Batch-update link sort order (supports cross-category moves) |
| `importBookmarks(htmlContent)` | `→ { imported, skipped, totalFound }` | Parse a Chrome HTML bookmark export and upsert all links |
| `getLibraryItems()` | `→ LibraryItem[]` | Fetch all PDF library items |
| `uploadPdfs(formData)` | `→ { uploaded }` | Upload PDF files to Appwrite Storage + create metadata documents |
| `deleteLibraryItem(id)` | `→ void` | Delete a library item and its storage file |
| `updateLibraryFolderOrder(updates)` | `→ void` | Batch-update folder sort order |
| `updateLibraryItemOrder(updates)` | `→ void` | Batch-update item sort order (supports cross-folder moves) |

### `src/app/auth-actions.ts`

| Function | Description |
|---|---|
| `signIn(formData)` | Authenticate with email/password, set session cookie, redirect to `/` |
| `signUp(formData)` | Register with email/password/accessCode, validate code, create user, set session cookie, redirect to `/` |
| `signOut()` | Delete Appwrite session, clear cookie, redirect to `/login` |
| `getLoggedInUser()` | Return the current user object or `null` |

### `src/middleware.ts`

Next.js Edge Middleware that:
- Allows `/login`, `/signup`, `/_next`, `/favicon` routes without auth.
- Redirects authenticated users away from `/login` and `/signup`.
- Redirects unauthenticated users to `/login` for all other routes.
- The `/api/*` routes are excluded from middleware matching (the API route does its own cookie check).

### `src/app/api/file/route.ts`

`GET /api/file?id=<fileId>` — Streams a PDF from Appwrite Storage.
- Checks for `appwrite-session` cookie (returns 401 if missing).
- Fetches the file from Appwrite Storage with `getFileView`.
- Returns the binary content with appropriate `Content-Type` and `Content-Disposition` headers.

### `src/components/Dashboard.tsx` (~936 lines)

The main client component. Handles:
- Panel switching (sidebar navigation, keyboard shortcuts).
- Category CRUD (add/delete forms).
- Link CRUD (add/edit/delete modals).
- Drag-and-drop reordering for categories, links, library folders, and library items.
- Chrome bookmark HTML import (file picker).
- PDF upload form, PDF viewer (embedded iframe with fullscreen toggle).
- Sign out button.

### `src/components/ThemeProvider.tsx`

Thin wrapper around `next-themes`'s `ThemeProvider`. Uses the `class` strategy so Tailwind's `dark:` variant works.

### `src/components/ThemeToggle.tsx`

Three-button toggle (Light / System / Dark) rendered in the sidebar.

### `src/app/globals.css`

- Imports Tailwind CSS v4.
- Defines custom CSS variables for light and dark themes (Slack-inspired color palette).
- Registers a custom Tailwind `@theme` with semantic color tokens (`--color-surface`, `--color-ink`, etc.).
- Custom scrollbar styling.

### `scripts/setup-appwrite.ts`

One-time setup script. Creates:
1. Database `ops-dashboard`
2. `categories` collection with attributes + index
3. `links` collection with attributes + indexes (including unique URL index)
4. `library-items` collection with attributes + indexes
5. `pdfs` storage bucket (50 MB limit: 50,000,000 bytes; gzip compression; PDF only)

Includes 3-second delays between attribute creation and index creation (Appwrite needs time to provision attributes before indexes can reference them).

---

## Deployment

### Vercel (recommended)

1. Push the repo to GitHub.
2. Import the project in [Vercel](https://vercel.com/).
3. Add all environment variables from `.env.local` to Vercel's project settings (Settings → Environment Variables).
4. Deploy. Vercel auto-detects Next.js.

### Other platforms

Any platform that supports Node.js 18+ and Next.js standalone builds:
- **Netlify**: Use `@netlify/plugin-nextjs`.
- **Railway / Render / Fly.io**: Use `npm run build && npm start`.
- **Docker**: Use the official [Next.js Docker example](https://github.com/vercel/next.js/tree/canary/examples/with-docker).

### Important deployment notes

- Ensure the `APPWRITE_API_KEY` is kept secret (server-side only, never exposed to the client).
- The server action body size limit is set to 48 MB in `next.config.ts` (Appwrite bucket max: 50,000,000 bytes ≈ 47.6 MiB).
- If you use a custom domain, no additional Appwrite configuration is needed — the SDK calls Appwrite server-to-server from Next.js, not from the browser.

---

## Common Tasks & Recipes

### Add a new attribute to an existing collection

1. Add the attribute in the Appwrite Console (or update `setup-appwrite.ts` for fresh setups).
2. Update the relevant server action in `src/app/actions.ts` to read/write the new field.
3. Update the TypeScript types in `src/components/Dashboard.tsx` if the field is used in the UI.

### Add a new collection

1. Add collection creation to `scripts/setup-appwrite.ts`.
2. Add the collection ID to `.env.local.example` and `.env.local`.
3. Export the new constant from `src/lib/appwrite.ts`.
4. Create server actions in `src/app/actions.ts`.
5. Build UI components as needed.

### Change the color theme

Edit `src/app/globals.css`. The `:root` block defines light-mode variables; the `.dark` block defines dark-mode variables. The `@theme inline` block maps variables to Tailwind utility classes (e.g., `bg-surface`, `text-ink`).

### Reset the database

Delete all three collections and the storage bucket in the Appwrite Console, then re-run:

```bash
npm run setup-appwrite
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| **"Setup failed" when running setup script** | Ensure `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, and `APPWRITE_API_KEY` are set in `.env.local`. Verify the API key has all required scopes. |
| **Login returns "Invalid credentials"** | Make sure you created a user in Appwrite Console → Auth → Users. The email must match exactly. |
| **Session expires unexpectedly** | The cookie lasts 30 days, but Appwrite sessions have their own TTL. Check your project's session settings in the Appwrite Console. |
| **PDF upload fails** | Check that the `pdfs` bucket exists and the API key has `files.write` scope. The Appwrite bucket limit is 50,000,000 bytes (approx 47.6 MiB); Next.js body size is set to 48 MB. |
| **Drag-and-drop doesn't persist** | The UI optimistically updates then calls a server action. Check the browser console for errors from the server action. |
| **Build error: "Property 'X' does not exist on type 'Document'"** | Appwrite's `Document` type doesn't include custom fields. Use the `AppDocument` type from `src/lib/appwrite.ts` (which adds `Record<string, unknown>`). |
| **`ERR_MODULE_NOT_FOUND` for setup script** | Run `npm install` first. The script needs `dotenv` and `node-appwrite`. |
