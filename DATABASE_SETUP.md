# Cloudflare D1 Database Setup

This guide explains how to set up the Cloudflare D1 (SQLite) database for storing quote form submissions.

## Prerequisites

- Cloudflare account with Pages/Workers access
- Wrangler CLI installed (`npm install -g wrangler` or `npm install wrangler --save-dev`)
- Cloudflare account authenticated (`wrangler login`)

## Step 1: Create D1 Database

The database `quotes-db` is already configured in `wrangler.toml`. If you need to create it from scratch:

**Via Wrangler CLI:**

```bash
wrangler d1 create quotes-db
```

This outputs a database ID. Update `wrangler.toml` with the new ID if needed:

```toml
[[d1_databases]]
binding = "DB"
database_name = "quotes-db"
database_id = "your-database-id-here"
```

**Via Cloudflare Dashboard:**

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages** > **D1**
3. Click **Create database**
4. Name it: `quotes-db`
5. Click **Create**

## Step 2: Configure Database Binding

### For Cloudflare Pages (Dashboard):

1. Go to your Pages project in Cloudflare Dashboard
2. Navigate to **Settings** > **Functions**
3. Under **D1 database bindings**, click **Add binding**
4. Set:
   - **Variable name**: `DB` (must match the binding name used in code)
   - **D1 database**: Select `quotes-db`
5. Click **Save**

### Via wrangler.toml (already done):

Your `wrangler.toml` already has the binding:

```toml
[[d1_databases]]
binding = "DB"
database_name = "quotes-db"
database_id = "8f864549-d98a-4659-ab21-605a815e7363"
```

## Step 3: Run Database Migration

Run the schema migration to create the `quotes` table:

```bash
# Production
wrangler d1 execute quotes-db --file=./schema.sql

# Local dev
wrangler d1 execute quotes-db --local --file=./schema.sql
```

## Step 4: Verify Database Setup

Query the database to verify the table was created:

```bash
wrangler d1 execute quotes-db --command="SELECT name FROM sqlite_master WHERE type='table';"
```

You should see `quotes` in the results.

## Step 5: Test Locally

```bash
# Create local database and run migration
wrangler d1 execute quotes-db --local --file=./schema.sql

# Start the local dev server
npx wrangler pages dev .
```

## Database Schema

The `quotes` table (defined in `schema.sql`) stores:

| Column         | Type    | Description |
|----------------|---------|-------------|
| `id`           | INTEGER | Auto-incrementing primary key |
| `name`         | TEXT    | Contact name (required) |
| `phone`        | TEXT    | Phone number (required) |
| `email`        | TEXT    | Email address (required) |
| `company`      | TEXT    | Company name (optional, nullable) |
| `pickup`       | TEXT    | Pickup location (required) |
| `delivery`     | TEXT    | Delivery location (required) |
| `freight_type` | TEXT    | Comma-separated freight types, e.g. `"Chilled, Frozen"` (required) |
| `created_at`   | TEXT    | ISO 8601 timestamp, e.g. `"2026-02-12T10:30:00.000Z"` (required) |

## Viewing Submissions

### Via Cloudflare D1 Console (recommended)

The easiest way to view submitted quotes without using the terminal:

1. Go to the [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages** > **D1**
3. Click on **quotes-db**
4. Click the **Console** tab
5. Run:

```sql
SELECT * FROM quotes ORDER BY created_at DESC;
```

You'll see all submissions in a table view directly in the browser.

### Via Wrangler CLI

```bash
# View the 10 most recent submissions
wrangler d1 execute quotes-db --command="SELECT * FROM quotes ORDER BY created_at DESC LIMIT 10;"

# Count total submissions
wrangler d1 execute quotes-db --command="SELECT COUNT(*) FROM quotes;"
```

## Troubleshooting

**Error: "Database is not available"**
- Ensure the binding name in your Cloudflare config matches `DB` (the variable name used in `functions/api/quote.js`)
- For local dev, ensure `wrangler.toml` has the `[[d1_databases]]` section

**Error: "Table does not exist" / "Database insert failed"**
- Run the migration: `wrangler d1 execute quotes-db --file=./schema.sql`
- For local dev: `wrangler d1 execute quotes-db --local --file=./schema.sql`

**Error: "Permission denied"**
- Ensure you're authenticated: `wrangler login`
- Verify you have access to the D1 database in your Cloudflare account

## Production Deployment

After deploying your Pages project:
1. Ensure the D1 binding (`DB` > `quotes-db`) is configured in the Pages project settings
2. Run the migration on the production database: `wrangler d1 execute quotes-db --file=./schema.sql`
3. Test by submitting a quote and checking the D1 Console for the new row
