exports.handler = async (event) => {
  try {

    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
      return {
        statusCode: 500,
        body: "API KEY missing",
      };
    }

    const body = JSON.parse(event.body);

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + API_KEY,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: err.toString(),
    };
  }
};