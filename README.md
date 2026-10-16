# Billions

A browser-first AI workspace for useful conversations, verified reports and repeatable work. This first slice is an interactive, local spreadsheet-report prototype built with Next.js, React and TypeScript.

## Run locally

Requires Node.js 24 (the tested version is 24.19.0) and npm.

```sh
npm ci
npm run dev
```

The app listens on port 3000. In this cloud workspace, use `npm ci --cache /workspace/.npm-cache` because the home directory is read-only. Use the existing checkout at `/workspace/billi-ai`; no separate Git worktree is needed.

## What works

- Responsive chat-and-output workspace, including mobile navigation.
- Sample data or real CSV upload, including drag and drop (up to 2 MB and 10,000 transactions).
- Strict column, date, record and currency validation. Financial calculations use integer cents.
- Weekly income, expense, net-movement and category summaries; daily chart and accessible table.
- Expandable checks, Markdown report download and limited report-related chat helpers.
- Local run history with search and clearing, and manual routine configurations with create/delete/reuse.

Select **Try this report** to start without uploading a file. The sample contains AUD 24,350 income, AUD 8,290 expenses and AUD 16,060 net movement across 12 transactions.

## CSV contract

```csv
date,description,category,amount
2026-10-05,Consulting,Services,1250.50
2026-10-06,Travel,Operations,-50.25
```

Use real YYYY-MM-DD dates spanning at most seven consecutive calendar days. Positive amounts are income, negative amounts are expenses; all amounts are AUD with at most two decimal places, without currency symbols or thousands separators. Quoted CSV fields are supported. The source file is not modified. This transaction summary is not a profit-and-loss statement or bank balance.

## Prototype boundary

No AI provider, accounts, tenant isolation, database, cloud storage, scheduling or external integrations are connected. The report narrative is a deterministic template and the chat has limited, explicit helpers. No API credentials are needed.

Uploaded files are processed in browser memory and not retained as source files. Up to 30 report summaries (including filenames, totals and categories) and 30 routine configurations persist in this browser's local storage. Clear report summaries through **Run history → Clear history**; delete routines individually. Do not treat browser storage as secure business storage. Use sample or non-sensitive data on shared devices. Fonts are loaded from Google Fonts with system fallbacks.

## Validation

```sh
npm test
npm run typecheck
npm run build
npm run test:e2e
```

Browser tests launch the development server automatically unless a server is already running on port 3000. They use `/usr/bin/chromium` when present, or Playwright's bundled browser. On another machine, install it with `npx playwright install chromium`, or set `CHROMIUM_EXECUTABLE` to an existing binary. The cloud instance includes system Chromium. Tests cover sample and uploaded reports, calculations, download content, invalid-input handling, browser persistence, routines, mobile navigation and cancellation.

For production-mode local validation, run `npm run build` followed by `npm start`. No deployment has been performed.

The scope and next production work are in [docs/MVP.md](docs/MVP.md).

## Deploy to Vercel

Import `farrowjacob9-lang/billi-ai` from GitHub into Vercel. Use the Next.js framework preset, the repository root (`./`) as the root directory, Node.js 24.x, and the default build command (`npm run build`) and output directory. The committed lockfile supplies the dependency versions. No environment variables or API credentials are required for this prototype.

Vercel deploys `main` as the production branch and can create preview deployments for pull requests. The production URL is assigned by Vercel after the first successful deployment. This repository does not contain a Vercel account binding or claim an existing deployment.

After deploying, run **Try this report** and verify the sample income, expense and net totals above; download the report; then check the mobile navigation. Browser history and routines belong to that deployment's origin and do not transfer from the local prototype or between preview URLs.
