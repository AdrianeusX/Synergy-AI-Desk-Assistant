import type { Handler, HandlerEvent } from "@netlify/functions";

const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { 
      statusCode: 405, 
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" }) 
    };
  }

  const path = event.path
    .replace("/.netlify/functions/api", "")
    .replace("/api", "");

  if (path === "/create-web-call") {
    try {
      const apiKey = process.env.RETELL_API_KEY;
      if (!apiKey) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: "RETELL_API_KEY is not set" }),
        };
      }

      const body = JSON.parse(event.body || "{}");
      const response = await fetch(
        "https://api.retellai.com/v2/create-web-call",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agent_id: body.agent_id || 
              "agent_8200db34622ed2489557a51a4a",
          }),
        }
      );

      const data = await response.json();
      return {
        statusCode: response.ok ? 200 : response.status,
        headers,
        body: JSON.stringify(data),
      };
    } catch (error) {
      console.error("Retell error:", error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Internal server error" }),
      };
    }
  }

  if (path === "/chat") {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: "GEMINI_API_KEY is not set" 
          }),
        };
      }

      const { message, history } = JSON.parse(event.body || "{}");

      const contents = [
        ...(history || []).map((msg: any) => ({
          role: msg.role === "agent" ? "model" : "user",
          parts: [{ text: msg.content }],
        })),
        { role: "user", parts: [{ text: message }] },
      ];

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents }),
        }
      );

      const data = await response.json();
      const reply =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Sorry, I could not process that. Please try again.";

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ reply }),
      };
    } catch (error) {
      console.error("Gemini error:", error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Failed to get response" }),
      };
    }
  }

  return {
    statusCode: 404,
    headers,
    body: JSON.stringify({ error: "Not found" }),
  };
};

export { handler };
