# PlanIt - the Resource Planning App

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/yorkewoo/Planit/blob/main/PlanIt.jpg" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally, now with a Supabase PostgreSQL database integration!

View your app in AI Studio: https://ai.studio/apps/0e2541ac-de78-4cf0-b98c-58fdf0c6361a

## Run Locally

**Prerequisites:** Node.js, Supabase Project

1. Install dependencies:
   `npm install`
2. Run the `supabase_schema.sql` script in your Supabase SQL Editor.
3. Rename `.env.example` to `.env` and fill in your `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
4. Run the app:
   `npm run dev`
