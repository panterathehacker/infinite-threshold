import { WORLD_LABS_API_KEY } from '../constants';

const API_BASE = "https://api.worldlabs.ai/marble/v1";
const PROXY_1 = "https://corsproxy.io/?";
const PROXY_2 = "https://api.allorigins.win/raw?url=";

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithProxy(endpoint: string, options: RequestInit) {
  const url = `${API_BASE}${endpoint}`;
  
  // 1. Try Direct (Best case)
  try {
    const res = await fetch(url, options);
    if (res.ok) return res;
  } catch (e) {}

  // 2. Try Proxy 1
  try {
    const res = await fetch(`${PROXY_1}${encodeURIComponent(url)}`, options);
    if (res.ok) return res;
  } catch (e) {}

  // 3. Try Proxy 2
  const res = await fetch(`${PROXY_2}${encodeURIComponent(url)}`, options);
  return res;
}

async function startGeneration(theme: string) {
  const res = await fetchWithProxy(`/worlds:generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'WLT-Api-Key': WORLD_LABS_API_KEY
    },
    body: JSON.stringify({
      display_name: theme.substring(0, 50),
      world_prompt: {
        type: "text",
        text_prompt: `A high quality 3D explorable world of ${theme}, immersive, detailed, photorealistic.`
      }
    })
  });

  if (!res.ok) throw new Error(`Generation trigger failed (${res.status})`);
  return res.json();
}

async function pollOperation(operationId: string, onStatusUpdate: (msg: string) => void) {
  const startTime = Date.now();
  const maxTime = 20 * 60 * 1000;

  while (Date.now() - startTime < maxTime) {
    onStatusUpdate(`Constructing Reality... (${Math.floor((Date.now() - startTime)/1000)}s)`);
    
    let res;
    try {
        res = await fetchWithProxy(`/operations/${operationId}?t=${Date.now()}`, {
            method: 'GET',
            headers: { 'WLT-Api-Key': WORLD_LABS_API_KEY }
        });
    } catch (e) {
        await wait(5000);
        continue;
    }

    if (!res.ok) {
        if (res.status >= 500 || res.status === 404) { await wait(5000); continue; }
        throw new Error(`Polling failed: ${res.status}`);
    }
    
    const data = await res.json();
    if (data.done) {
      if (data.error) throw new Error(`Generation error: ${JSON.stringify(data.error)}`);
      return data.response;
    }
    await wait(10000);
  }
  throw new Error("Generation timed out.");
}

// Deep search helper for URLs
function findUrlByExtension(obj: any, ext: string): string | null {
  if (!obj) return null;
  if (typeof obj === 'string' && obj.toLowerCase().includes(ext)) return obj;
  if (typeof obj === 'object') {
    for (const key in obj) {
      const found = findUrlByExtension(obj[key], ext);
      if (found) return found;
    }
  }
  return null;
}

export const generateWorldFromText = async (
  theme: string,
  setStatus: (msg: string) => void
): Promise<{ splatUrl: string; imageUrl: string }> => {
  try {
    setStatus("Initiating World Protocol...");
    const operation = await startGeneration(theme);
    const worldData = await pollOperation(operation.operation_id, setStatus);
    
    // Aggressive extraction
    let splatUrl = findUrlByExtension(worldData, '.spz');
    let imageUrl = findUrlByExtension(worldData, 'thumbnail') || findUrlByExtension(worldData, '.webp') || findUrlByExtension(worldData, '.jpg');

    console.log("[WorldLabs] Extracted Assets:", { splatUrl, imageUrl });

    return { splatUrl: splatUrl || "", imageUrl: imageUrl || "" };
  } catch (error) {
    console.error("World Labs Error:", error);
    throw error;
  }
};