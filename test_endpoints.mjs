async function run() {
  try {
    const statusRes = await fetch('http://localhost:5173/api/gmail/status');
    const statusData = await statusRes.json();
    console.log('Status endpoint:', statusRes.status, statusData);

    const authRes = await fetch('http://localhost:5173/api/gmail/auth?redirect=false', {
      headers: { Accept: 'application/json' }
    });
    const authData = await authRes.json();
    console.log('Auth endpoint status:', authRes.status, 'has authUrl:', !!authData.authUrl);
    if (authData.authUrl) {
      console.log('Auth URL includes oauth2:', authData.authUrl.includes('accounts.google.com/o/oauth2/v2/auth'));
      console.log('Auth URL includes scope:', authData.authUrl.includes('scope='));
      console.log('Auth URL includes state:', authData.authUrl.includes('state='));
    }

    const invalidCbRes = await fetch('http://localhost:5173/api/gmail/callback?state=invalid_token&code=4/fakecode');
    console.log('Invalid callback status:', invalidCbRes.status);
    const cbData = await invalidCbRes.json().catch(() => null);
    console.log('Invalid callback data:', cbData);

  } catch (err) {
    console.error('Error in test:', err);
  }
}

run();
