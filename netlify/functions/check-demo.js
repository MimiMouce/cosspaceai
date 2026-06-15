exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const { deviceId } = JSON.parse(event.body || "{}");

    if (!deviceId) {
      return { statusCode: 400, headers, body: JSON.stringify({ allowed: false, error: "Missing deviceId" }) };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ allowed: false, error: "Missing Supabase env vars" }) };
    }

    const now = new Date();
    const expires = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const findRes = await fetch(`${SUPABASE_URL}/rest/v1/demo_users?device_id=eq.${encodeURIComponent(deviceId)}&select=*`, {
      headers: {
        apikey: SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${SUPABASE_SECRET_KEY}`
      }
    });

    const existing = await findRes.json();

    if (Array.isArray(existing) && existing.length > 0) {
      const user = existing[0];

      if (user.active === false) {
        return { statusCode: 200, headers, body: JSON.stringify({ allowed: false, reason: "inactive" }) };
      }

      if (user.expires_at && new Date(user.expires_at) < now) {
        return { statusCode: 200, headers, body: JSON.stringify({ allowed: false, reason: "expired" }) };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ allowed: true, expires_at: user.expires_at })
      };
    }

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/demo_users`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        email: `visitor-${deviceId.slice(0, 8)}@cosspaceai.demo`,
        device_id: deviceId,
        first_visit: now.toISOString(),
        expires_at: expires.toISOString(),
        active: true
      })
    });

    const created = await insertRes.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ allowed: true, expires_at: expires.toISOString(), created })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ allowed: false, error: error.message || "Server error" })
    };
  }
};
