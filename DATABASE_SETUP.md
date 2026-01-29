# Cloudflare D1 Database Setup Instructions

This guide explains how to set up Cloudflare D1 (SQLite) database for storing quote form submissions.

## Prerequisites

- Cloudflare account with Pages/Workers access
- Wrangler CLI installed (`npm install -g wrangler` or `npm install wrangler --save-dev`)
- Cloudflare account authenticated (`wrangler login`)

## Step 1: Create D1 Database

1. **Via Cloudflare Dashboard:**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - Navigate to **Workers & Pages** → **D1**
   - Click **Create database**
   - Name it: `quote-submissions` (or your preferred name)
   - Choose a region (e.g., `apac` for Asia-Pacific)
   - Click **Create**

2. **Via Wrangler CLI:**
   ```bash
   wrangler d1 create quote-submissions
   ```
   
   This will output a database ID. Save this for the next step.

## Step 2: Configure Database Binding

### For Cloudflare Pages:

1. Go to your Pages project in Cloudflare Dashboard
2. Navigate to **Settings** → **Functions**
3. Under **D1 database bindings**, click **Add binding**
4. Set:
   - **Variable name**: `DB` (must match the binding name used in code)
   - **D1 database**: Select `quote-submissions`
5. Click **Save**

### For Cloudflare Workers (wrangler.toml):

Add to your `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "quote-submissions"
database_id = "your-database-id-here"
```

## Step 3: Run Database Migration

Run the schema migration to create the `quotes` table:

```bash
wrangler d1 execute quote-submissions --file=./schema.sql
```

Or if using a database ID:
```bash
wrangler d1 execute <database-id> --file=./schema.sql
```

## Step 4: Verify Database Setup

Query the database to verify the table was created:

```bash
wrangler d1 execute quote-submissions --command="SELECT name FROM sqlite_master WHERE type='table';"
```

You should see `quotes` in the results.

## Step 5: Test Locally (Optional)

To test with a local D1 database:

```bash
# Create local database
wrangler d1 execute quote-submissions --local --file=./schema.sql

# Run local dev server
wrangler pages dev --d1=DB=quote-submissions
```

## Environment Variables

No additional environment variables are needed for D1. The database binding is configured through Cloudflare's binding system (not env vars).

## Database Schema

The `quotes` table stores:
- `id`: Auto-incrementing primary key
- `name`, `email`, `phone`, `company`: Contact information
- `pickup`, `delivery`: Location details
- `freight_type`: JSON array of selected freight types (stored as TEXT)
- `ip_address`: Client IP address (from Cloudflare headers)
- `submitted_at`: ISO 8601 timestamp
- `created_at`: Unix timestamp for efficient sorting

## Querying Submissions

View recent submissions:

```bash
wrangler d1 execute quote-submissions --command="SELECT * FROM quotes ORDER BY created_at DESC LIMIT 10;"
```

Or via Cloudflare Dashboard:
- Go to **Workers & Pages** → **D1** → **quote-submissions**
- Click **Console** tab
- Run SQL queries directly

## Troubleshooting

**Error: "Database binding not found"**
- Ensure the binding name in your Cloudflare config matches `DB` (the variable name used in `functions/api/quote.js`)

**Error: "Table does not exist"**
- Run the migration: `wrangler d1 execute quote-submissions --file=./schema.sql`

**Error: "Permission denied"**
- Ensure you're authenticated: `wrangler login`
- Verify you have access to the D1 database in your Cloudflare account

## Production Deployment

After deploying your Pages/Worker:
1. Ensure the D1 binding is configured in production environment
2. Run migrations on production database (if needed)
3. Test form submission to verify data is being stored
