# Jobline

Jobline is a shared, no-login job scheduler built with Next.js, Vercel, and Appwrite.

## Included

- Month, week, day, and agenda calendar views
- Zoom controls between month, week, and day views
- Active jobs and a separate completed archive
- Job and payment status filters
- Search across job names, addresses, contacts, and quote details
- Optional start time and duration
- Plain-text quote details
- Multiple attachment uploads per job
- Drag-to-reschedule calendar entries
- Automatic polling for changes made on another device

## Appwrite setup

1. Create an Appwrite project and an API key with Databases and Storage permissions.
2. Copy `.env.example` to `.env.local` and fill in `APPWRITE_PROJECT_ID` and `APPWRITE_API_KEY`.
3. Run:

```bash
npm run setup:appwrite
```

The script creates the `jobs` database, `jobs` collection, job attributes, and the `job-attachments` bucket. Override the IDs in `.env.local` if you want different resource names.

The API key is used only by Next.js route handlers. It is never exposed to the browser.

## Local development

```bash
npm install
npm run dev
```

If Appwrite is not configured, the interface still renders, but data operations show a setup message.

## Vercel deployment

Add the variables from `.env.example` to the Vercel project for Production, Preview, and Development as needed. Deploy the project with the Vercel Git integration or CLI.

## No-login tradeoff

This version intentionally has no account system. Everyone who can reach the deployment shares the same workspace and can edit its jobs. That keeps the workflow frictionless, but it is not appropriate for confidential quotes until a shared access code or user authentication is added.
