# Deployment

AIRA is designed to be seamlessly deployed on Vercel.

## Vercel Deployment
1. Connect your GitHub repository to Vercel.
2. The framework preset should automatically be detected as **Vite**.
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Install Command: `npm install`

## Environment Variables Configuration
You must meticulously copy all variables from your local `.env` into the Vercel Project Settings -> Environment Variables dashboard.
- Ensure `FIREBASE_SERVICE_ACCOUNT_KEY` is pasted as a single, valid JSON string.
- Ensure `GOOGLE_REDIRECT_URI` is updated to point to your Vercel production domain (e.g., `https://your-domain.vercel.app/api/gmail/callback`).

## Google OAuth Configuration
In the Google Cloud Console:
1. Go to Credentials -> OAuth 2.0 Client IDs.
2. Add your Vercel production URL to **Authorized JavaScript origins**.
3. Add your Vercel callback URL to **Authorized redirect URIs**.

## Serverless Function Routing
The `vercel.json` file explicitly routes `/api/(.*)` to the `api/` folder, ensuring Node.js serverless execution alongside the Vite static frontend build.
