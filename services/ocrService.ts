
import { GoogleGenAI, Type } from "@google/genai";

console.log("ENV KEY:", import.meta.env.VITE_GEMINI_API_KEY);

export const extractOwnerInfoFromImage = async (
    filePart: { inlineData: { data: string, mimeType: string } }
): Promise<{
    nom: string;
    prenom: string;
    cin: string;
    validite: string;
    adresse: string;
}> => {
    const prompt = `
        Analyse cette image de Carte Nationale d'Identité (CIN) marocaine (Recto ou Verso).
        Extrais les informations suivantes :
        
        1. Nom (de famille) - Transcrire en Majuscules
        2. Prénom - Première lettre majuscule
        3. Numéro de CIN (Carte d'Identité Nationale) - Ex: J123456
        4. Date de validité (Valable jusqu'au) - Format YYYY-MM-DD
        5. Adresse complète

        Si une information n'est pas trouvée ou illisible, laisse le champ vide.
        Retourne uniquement un JSON.
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            nom: { type: Type.STRING, description: "Nom de famille" },
            prenom: { type: Type.STRING, description: "Prénom" },
            cin: { type: Type.STRING, description: "Numéro de la CIN" },
            validite: { type: Type.STRING, description: "Date de validité au format YYYY-MM-DD" },
            adresse: { type: Type.STRING, description: "Adresse de résidence" },
        },
        required: ["nom", "prenom", "cin"],
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { text: prompt },
                    filePart
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });

        const text = response.text;
        if (!text) throw new Error("Réponse vide de l'IA.");
        
        const cleanedJson = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
        return JSON.parse(cleanedJson);

    } catch (error) {
        console.error("Erreur Gemini OCR CIN:", error);
        throw new Error("Impossible d'extraire les informations via l'IA. Vérifiez votre connexion.");
    }
};
