export default async function handler(req, res) {
  console.log("Request Method:", req.method);
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed. Received: " + req.method });
    }

    const { message } = req.body;

    // TEMP TEST RESPONSE (IMPORTANT)
    return res.status(200).json({
      reply: "API WORKING: " + message
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}
