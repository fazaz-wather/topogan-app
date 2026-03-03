// services/geminiService.ts

// ==========================
// 🔹 Generic Gemini Caller
// ==========================

const callGemini = async (contents: any) => {
  const response = await fetch("/.netlify/functions/gemini", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gemini-1.5-flash",
      contents,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Server error");
  }

  return await response.json();
};

const extractText = (data: any): string => {
  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text || ""
  );
};

// ==========================
// 1️⃣ Generate Description
// ==========================

export const generateParcelDescription = async (
  prompt: string
): Promise<string> => {
  try {
    const data = await callGemini([
      {
        parts: [{ text: prompt }],
      },
    ]);

    return extractText(data) || "Aucune description générée.";
  } catch (error) {
    console.error(error);
    return "Erreur lors de la génération.";
  }
};

// ==========================
// 2️⃣ Extract Points
// ==========================

export const extractPointsFromFile = async (
  prompt: string,
  filePart: any
) => {
  try {
    const data = await callGemini([
      {
        parts: [
          { text: prompt },
          filePart,
        ],
      },
    ]);

    let text = extractText(data);

    if (!text) throw new Error("Empty response");

    text = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/, "")
      .trim();

    return JSON.parse(text);

  } catch (error) {
    console.error(error);
    throw new Error("Impossible d'extraire les points.");
  }
};

// ==========================
// 3️⃣ OCR CIN
// ==========================

export const extractOwnerInfoFromImage = async (
  prompt: string,
  filePart: any
) => {
  try {
    const data = await callGemini([
      {
        parts: [
          { text: prompt },
          filePart,
        ],
      },
    ]);

    let text = extractText(data);

    if (!text) throw new Error("Empty response");

    text = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/, "")
      .trim();

    const parsed = JSON.parse(text);

    return {
      nom: parsed.nom || "",
      prenom: parsed.prenom || "",
      cin: parsed.cin || "",
      validite: parsed.validite || "",
      adresse: parsed.adresse || "",
    };

  } catch (error) {
    console.error(error);
    throw new Error("Impossible d'extraire les informations de la CIN.");
  }
};