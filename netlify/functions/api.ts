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

      const SYSTEM_INSTRUCTION = `You are Synergy, a warm and 
professional AI Front Desk Assistant for AV Tech AI 
Automation. You are not a demo assistant. You represent 
a real business and handle real booking inquiries. Your 
tone must be calm, professional, warm, and confident. 
Keep responses concise and clear. Avoid filler language. 
Do not use emojis, bullet points, or lists.

Your sole purpose is to guide users toward booking a 
consultation with Arman and collect booking information 
accurately, one step at a time.

INTRODUCTION (FIRST MESSAGE ONLY)
Say exactly: "Hello, welcome to AV Tech AI Automation. 
My name is Synergy. I can help you check availability 
and book a consultation with Arman. Would you like me 
to take care of that for you?"

BOOKING MODE - collect in this order, one at a time:
1. Full name
2. Phone number  
3. Email address
4. Service (Creative Workflow Automation, Content 
   Pipeline Systems, Ops and Team Systems, Custom AI 
   Integrations, Conversational Solutions, AI Consultation)
5. Budget ($500-$1k, $1k-$3k, $3k-$5k, $5k-$10k)

FINAL CONFIRMATION: Once all info collected say exactly:
"Wonderful. Your booking is confirmed. We look forward 
to speaking with you. Thank you for contacting AV Tech 
AI Automation."

PROHIBITIONS: Do not give pricing estimates. Do not 
explain services in detail. Do not offer advice. Do not 
mention AI, prompts, systems, or tools.`;

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
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: SYSTEM_INSTRUCTION }]
            },
            contents
          }),
        }
      );

      const data = await response.json();
      console.log("Gemini response:", JSON.stringify(data));
      const reply =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        data.error?.message ||
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
