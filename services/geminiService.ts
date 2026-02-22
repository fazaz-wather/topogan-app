
import { GoogleGenAI, Type } from "@google/genai";
import { Point, CalculationResults, AppSettings } from '../types';
import { convertArea, convertDistance, getAreaUnitLabel, getDistanceUnitLabel } from './unitConversionService';

// Per Gemini API guidelines, initialize with import.meta.env.VITE_GEMINI_API_KEY directly and assume it's set.
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export const generateParcelDescription = async (
  points: Point[],
  results: CalculationResults | null,
  settings: AppSettings
): Promise<string> => {
  if (points.length < 3 || !results) {
    return "Données insuffisantes pour générer une description.";
  }

  const { precision, distanceUnit, areaUnit } = settings;
  const displayedArea = convertArea(results.area, areaUnit);
  const areaLabel = getAreaUnitLabel(areaUnit);
  const distanceLabel = getDistanceUnitLabel(distanceUnit);

  const pointDetails = points.map((p, index) => `Borne B${index + 1} (ID ${p.id}): (X=${p.x.toFixed(precision)}, Y=${p.y.toFixed(precision)})`).join('\n');
  
  const distanceDetails = results.distances.map((d) => {
    const fromIndex = points.findIndex(p => p.id === d.from) + 1;
    const toIndex = points.findIndex(p => p.id === d.to) + 1;
    const displayedDistance = convertDistance(d.distance, distanceUnit);
    return `Segment de la Borne B${fromIndex} à la Borne B${toIndex}: Distance = ${displayedDistance.toFixed(precision)} ${distanceLabel}`;
  }).join('\n');

  const prompt = `
    En tant qu'expert géomètre-topographe, rédigez une description technique et formelle d'une parcelle de terrain en français, en utilisant le style "bornes et limites" (metes and bounds). 
    Utilisez les données suivantes pour décrire la parcelle. La description doit commencer par un point de départ, puis suivre le périmètre point par point jusqu'au retour au point de départ.
    Pour chaque segment, indiquez la direction approximative (par exemple, "vers le nord-est") et la distance.

    Données de la parcelle:
    - Nombre de sommets: ${points.length}
    - Surface totale: ${displayedArea.toFixed(precision)} ${areaLabel}

    Coordonnées des sommets (dans l'ordre du périmètre):
    ${pointDetails}

    Distances des segments:
    ${distanceDetails}

    Commencez la description par "Description de la parcelle de terrain :" et soyez précis et professionnel.
  `;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
    });
    return response.text || "Aucune description générée.";
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return "Une erreur est survenue lors de la génération de la description. Veuillez consulter la console pour plus de détails.";
  }
};

export const extractPointsFromFile = async (
    filePart: { inlineData: { data: string, mimeType: string } } | { text: string }
): Promise<{ layerName: string; points: { x: number; y: number }[] }[]> => {
    const prompt = `
        En tant qu'expert en Systèmes d'Information Géographique (SIG), analysez les données fournies pour extraire les couches de points (sommets, bornes).

        Les données peuvent être :
        1. **Texte/XML** : Contenu extrait d'un fichier QGIS (.qgs), KML, GPX, GeoJSON ou CSV.
        2. **Image/PDF** : Un plan ou un tableau de coordonnées.

        **INSTRUCTIONS D'ANALYSE :**
        
        *   **Pour un projet QGIS (.qgs / XML)** :
            -   Analysez la structure XML pour identifier les couches vectorielles (balises \`<maplayer>\` ou \`<layer-tree-layer>\`).
            -   Pour chaque couche contenant des données géométriques de type POINT :
                -   Extrayez le nom de la couche (balise \`<layername>\` ou attribut \`name\`).
                -   Extrayez toutes les coordonnées des points. Cherchez dans les balises \`<wkt>\` (ex: "POINT(x y)"), \`<geometry>\`, ou les attributs des \`<feature>\`.
            -   Ignorez les couches qui ne contiennent pas de points.

        *   **Pour un fichier KML / GPX** :
            -   Extrayez les "Placemarks" ou "Waypoints".
            -   Utilisez le nom du dossier ou du document comme nom de couche.

        *   **Pour une Image, un PDF ou un CSV** :
            -   Détectez les listes de coordonnées numériques (X/Y, Lat/Lon, Est/Nord).
            -   Créez une seule couche nommée "Données importées".

        **FORMAT DE SORTIE (JSON STRICT) :**
        
        Retournez EXCLUSIVEMENT un tableau JSON d'objects, sans Markdown, sans explications.
        
        [
          {
            "layerName": "Nom de la couche détectée",
            "points": [
              { "x": 123456.78, "y": 987654.32 },
              { "x": 123460.12, "y": 987660.45 }
            ]
          },
          ...
        ]

        Si aucune coordonnée valide n'est trouvée, retournez un tableau vide : [].
    `;
    
    const schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                layerName: {
                    type: Type.STRING,
                    description: "Le nom de la couche de points ou du groupe de données."
                },
                points: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            x: {
                                type: Type.NUMBER,
                                description: "Coordonnée X (Est ou Longitude)"
                            },
                            y: {
                                type: Type.NUMBER,
                                description: "Coordonnée Y (Nord ou Latitude)"
                            }
                        },
                        required: ["x", "y"]
                    }
                }
            },
            required: ["layerName", "points"]
        }
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
        if (!text) {
            throw new Error("Réponse vide de l'IA.");
        }

        const jsonText = text.trim();
        const cleanedJson = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        
        const parsed = JSON.parse(cleanedJson);
        
        if (Array.isArray(parsed)) {
            if (parsed.length > 0 && (!parsed[0].layerName || !Array.isArray(parsed[0].points))) {
                 throw new Error("Structure JSON invalide retournée par l'IA.");
            }
            return parsed;
        }
        throw new Error("La réponse n'est pas un tableau de couches.");

    } catch (error) {
        console.error("Erreur de l'API Gemini lors de l'extraction des points :", error);
        
        let msg = "Impossible d'analyser le fichier avec l'IA.";
        if (error instanceof Error) {
            if (error.message.includes('token') || error.message.includes('400')) {
                msg = "Le fichier est trop volumineux pour l'IA (Limite de tokens dépassée). Veuillez utiliser un fichier plus petit ou un format vectoriel (SHP, KML, JSON) importé via l'outil local.";
            } else if (error.message.includes('SAFETY')) {
                msg = "La requête a été bloquée pour des raisons de sécurité par l'IA.";
            } else {
                msg = `${msg} ${error.message}`;
            }
        }
        throw new Error(msg);
    }
};

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
        Extrais les informations suivantes si elles sont visibles :
        
        1. Nom (de famille)
        2. Prénom
        3. Numéro de CIN (Carte d'Identité Nationale)
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
        throw new Error("Impossible d'extraire les informations de la CIN.");
    }
};
