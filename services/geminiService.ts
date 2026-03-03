// services/geminiService.ts

// 🔹 Generic secure Gemini call
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
    const errorText = await response.text();
    throw new Error(errorText || "Server error");
  }

  return await response.json();
};

// 🔹 Extract text safely
const extractText = (data: any): string => {
  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text || ""
  );
};



// =====================================
// 1️⃣ Generate Parcel Description
// =====================================

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
    console.error("Gemini error:", error);
    return "Erreur lors de la génération de la description.";
  }
};



// =====================================
// 2️⃣ Extract Points From File
// =====================================

export const extractPointsFromFile = async (
  prompt: string,
  filePart: any
) => {
  try {
    const data = await callGemini({
      parts: [
        { text: prompt },
        filePart,
      ],
    });

    const text = extractText(data);

    if (!text) {
      throw new Error("Réponse vide");
    }

    return JSON.parse(text);
  } catch (error) {
    console.error("Extraction error:", error);
    throw new Error("Impossible d'extraire les points du fichier.");
  }
};



// =====================================
// 3️⃣ Extract Owner Info From Image
// =====================================

export const extractOwnerInfoFromImage = async (
  prompt: string,
  filePart: any
) => {
  try {
    const data = await callGemini({
      parts: [
        { text: prompt },
        filePart,
      ],
    });

    const text = extractText(data);

    if (!text) {
      throw new Error("Réponse vide");
    }

    return JSON.parse(text);
  } catch (error) {
    console.error("OCR error:", error);
    throw new Error("Impossible d'extraire les informations.");
  }
};