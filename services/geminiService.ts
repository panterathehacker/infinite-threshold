import { GoogleGenAI } from "@google/genai";

let genAI: GoogleGenAI | null = null;

const getClient = (): GoogleGenAI => {
  // We recreate the client to ensure we pick up the latest key if it changed
  // In a real app, we might cache this, but with the key selector pattern, this is safer.
  const key = process.env.API_KEY;
  if (!key) {
    throw new Error("API Key not found via process.env.API_KEY");
  }
  return new GoogleGenAI({ apiKey: key });
};

export const generateWorldImage = async (theme: string): Promise<string> => {
  try {
    const ai = getClient();
    
    // Using gemini-3-pro-image-preview for high fidelity as requested (Nano Banana Pro)
    // This model requires the user to select their own key via the UI flow implemented in App.tsx
    const modelId = 'gemini-3-pro-image-preview';
    
    const prompt = `First-person view, immersive, photorealistic, 8k resolution, highly detailed, eye-level perspective of ${theme}. The image should look like a real place you can walk into. Balanced lighting, wide angle.`;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
         imageConfig: {
             aspectRatio: "1:1",
             imageSize: "1K"
         }
      }
    });

    // Parse the response to find the image part
    if (response.candidates && response.candidates.length > 0) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
           const mimeType = part.inlineData.mimeType || 'image/png';
           return `data:${mimeType};base64,${part.inlineData.data}`;
        }
      }
    }

    throw new Error("No image data found in Gemini response");
  } catch (error) {
    console.error("Gemini Image Generation Error:", error);
    throw error;
  }
};