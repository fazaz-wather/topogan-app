// netlify/functions/gemini.js

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: "Method Not Allowed",
      };
    }

    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
      return {
        statusCode: 500,
        body: "GEMINI_API_KEY is missing in environment variables",
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        body: "Request body is missing",
      };
    }

    const body = JSON.parse(event.body);

    if (!body.model || !body.contents) {
      return {
        statusCode: 400,
        body: "Invalid request format",
      };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${body.model}:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: body.contents,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify(data),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: error instanceof Error ? error.message : "Server error",
    };
  }
};