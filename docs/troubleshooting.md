# Troubleshooting

Common issues and their resolutions.

## Gmail OAuth Fails with "redirect_uri_mismatch"
- **Cause**: The `GOOGLE_REDIRECT_URI` in your `.env` does not exactly match the URI configured in Google Cloud Console.
- **Solution**: Verify the URI in Google Cloud Console exactly matches your environment variable (including `http` vs `https` and trailing slashes).

## 500 Internal Server Error on API Calls
- **Cause**: Usually missing server-side environment variables or invalid Firebase Admin credentials.
- **Solution**: Check the Vercel function logs (or local console). Ensure `FIREBASE_SERVICE_ACCOUNT_KEY` is properly formatted JSON.

## Voice Recognition Not Starting (Orb Stuck on Idle)
- **Cause**: Browser denied microphone permissions, or navigating over HTTP instead of HTTPS.
- **Solution**: Ensure the site is served over HTTPS (or localhost). Check browser permissions and click "Allow Microphone".

## "Error parsing Gmail payload"
- **Cause**: Gmail MIME multipart decoding issues for complex HTML emails.
- **Solution**: The `createCleanBody` function in `gmailService.js` attempts to sanitize this. If a specific email breaks it, check the Vercel logs for the raw MIME structure and adjust the parsing regex.

## "Cannot fetch thread... Invalid id value"
- **Cause**: The LLM hallucinated a Thread ID format when instructed to read a thread.
- **Solution**: Ensure the `parseGmailIntentAsync` validation logic is correctly blocking invalid format IDs before they hit the Gmail API.
