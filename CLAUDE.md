# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JobFinderJS is a LinkedIn job scraper that fetches job listings via LinkedIn's internal Voyager API, normalizes the data, saves results locally, and can email results via SMTP.

## Commands

```bash
npm start              # Run job search and save results to ./results/{timestamp}/
npm run send:results   # Email the most recent results
npm run start:all      # Run search then email results
npm run smtp:verify    # Test SMTP configuration
```

## Architecture

The project is ESM-based (`"type": "module"` in package.json). Entry point is `index.mjs`.

### Data Flow

1. **index.mjs** - Entry point that orchestrates the search workflow
2. **lib/jobs/searchJobs.js** - Coordinates URL building, HTTP request, and normalization
3. **lib/jobs/buildQuery.js** - Constructs LinkedIn Voyager API URLs with Rest.li-style query syntax
4. **lib/jobs/normalize.js** - Extracts job data from LinkedIn's nested response format into flat objects
5. **lib/storage/persist.js** - Saves JSON/HTML results to timestamped directories under `./results/`
6. **scripts/sendResults.mjs** - Reads latest results and sends email summary

### Key Modules

- **lib/api/httpClient.js** - Axios client with LinkedIn authentication headers (cookies from `.env`)
- **lib/email/mailer.js** - Nodemailer wrapper using SMTP config from `.env`
- **lib/storage/resultsUtils.js** - Finds most recent results directory
- **config.js** - Default search parameters (keywords, experience level, time range)

### Authentication

LinkedIn auth requires two cookies in `.env`:
- `LI_AT` - Main session cookie
- `JSESSIONID` - CSRF token (used as both cookie and header)

### Output Structure

Each run creates a timestamped folder in `./results/` containing:
- `response.json` - Raw API response
- `normalized.json` - Cleaned job data array
- `table.html` - HTML table for display/email
