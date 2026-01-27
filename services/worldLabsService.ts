import { WORLD_LABS_API_KEY } from '../constants';

const API_BASE = "https://api.worldlabs.ai/marble/v1";

// Helper to convert Base64 to Blob
const base64ToBlob = async (base64: string): Promise<Blob> => {
  const base64Clean = base64.replace(/^data:image\/\w+;base64,/, '');
  const response = await fetch(`data:image/jpeg;base64,${base64Clean}`);
  return response.blob();
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Step 1: Prepare Upload
async function prepareUpload() {
  const res = await fetch(`${API_BASE}/media-assets:prepare_upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'WLT-Api-Key': WORLD_LABS_API_KEY
    },
    body: JSON.stringify({
      file_name: "dream_world.jpg",
      kind: "image",
      extension: "jpg"
    })
  });

  if (!res.ok) throw new Error(`Prepare upload failed: ${await res.text()}`);
  return res.json();
}

// Step 2: Upload Binary
async function uploadFile(uploadUrl: string, blob: Blob, requiredHeaders: Record<string, string>) {
  // We must respect the required headers from the prepare_upload step
  // usually x-goog-content-length-range
  const headers: Record<string, string> = { ...requiredHeaders };
  
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: headers,
    body: blob
  });

  if (!res.ok) throw new Error(`File upload failed: ${await res.text()}`);
}

// Step 3: Trigger Generation
async function startGeneration(mediaAssetId: string, theme: string) {
  const res = await fetch(`${API_BASE}/worlds:generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'WLT-Api-Key': WORLD_LABS_API_KEY
    },
    body: JSON.stringify({
      display_name: theme.substring(0, 30),
      world_prompt: {
        type: "image",
        image_prompt: {
          source: "media_asset",
          media_asset_id: mediaAssetId
        },
        text_prompt: `A high quality 3D explorable world of ${theme}`
      }
    })
  });

  if (!res.ok) throw new Error(`Generation trigger failed: ${await res.text()}`);
  return res.json(); // Returns an Operation object
}

// Step 4: Poll Operation
async function pollOperation(operationName: string, onStatusUpdate: (msg: string) => void) {
  // Operation name is usually "operations/123..."
  // Endpoint is likely https://api.worldlabs.ai/marble/v1/{operationName}
  const url = `${API_BASE}/${operationName}`;
  
  let attempts = 0;
  const maxAttempts = 60; // 60 * 2s = 2 minutes max

  while (attempts < maxAttempts) {
    attempts++;
    onStatusUpdate(`Processing reality geometry... (${attempts*2}s)`);
    
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'WLT-Api-Key': WORLD_LABS_API_KEY }
    });

    if (!res.ok) throw new Error(`Polling failed: ${await res.text()}`);
    
    const data = await res.json();
    
    if (data.done) {
      if (data.error) {
        throw new Error(`Generation logic error: ${JSON.stringify(data.error)}`);
      }
      return data.response; // The completed World object
    }

    await wait(2000);
  }
  throw new Error("Generation timed out");
}

export const generateSplatFromImage = async (
  base64Image: string, 
  theme: string,
  setStatus: (msg: string) => void
): Promise<string> => {
  try {
    // 1. Prepare
    setStatus("Initiating Asset Upload...");
    const prepData = await prepareUpload();
    const { upload_url, required_headers } = prepData.upload_info;
    const mediaAssetId = prepData.media_asset.id;

    // 2. Upload
    setStatus("Uploading Neural Dream...");
    const imageBlob = await base64ToBlob(base64Image);
    await uploadFile(upload_url, imageBlob, required_headers);

    // 3. Generate
    setStatus("Requesting Construction...");
    const operation = await startGeneration(mediaAssetId, theme);
    console.log("Operation started:", operation.name);

    // 4. Poll
    const worldData = await pollOperation(operation.name, setStatus);
    console.log("World Generation Complete:", worldData);

    // 5. Extract URL
    // The world object structure needs to be checked. Assuming .links.spz or similar based on previous attempts
    // If exact structure is unknown, we check common paths.
    // Based on user prompt: "completed operation’s response field will contain the generated World"
    
    // Check known paths for Splat URL
    if (worldData.links?.spz) return worldData.links.spz;
    if (worldData.links?.ply) return worldData.links.ply;
    if (worldData.links?.gaussian_splat) return worldData.links.gaussian_splat;
    
    // Fallback if structure is different
    if (worldData.spz) return worldData.spz;
    if (worldData.url) return worldData.url;

    throw new Error("Resulting world object missing .links.spz URL");

  } catch (error) {
    console.error("World Labs Pipeline Error:", error);
    throw error;
  }
};