import { WORLD_LABS_API_KEY } from '../constants';

const API_BASE = "https://api.worldlabs.ai/marble/v1";
// Use a public CORS proxy to bypass browser-side CORS restrictions for this demo.
const PROXY_BASE = "https://corsproxy.io/?";

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function getErrorDetails(res: Response): Promise<string> {
    try {
        const text = await res.text();
        // If the response is HTML (like Cloudflare 5xx pages), return a generic error instead of dumping HTML
        if (text.trim().startsWith('<') || text.includes('<!DOCTYPE html>')) {
            return `Service Unavailable (${res.status})`;
        }
        return text;
    } catch {
        return `Unknown Error (${res.status})`;
    }
}

async function fetchWithProxy(endpoint: string, options: RequestInit) {
  // Construct full URL. 
  const url = `${API_BASE}${endpoint}`;
  
  // Strategy: Try direct first (if API allows CORS), then fallback to proxy.
  try {
    const res = await fetch(url, options);
    return res;
  } catch (e) {
    // console.log("[WorldLabs] Direct fetch failed (likely CORS). Switching to Proxy.");
  }

  // Fallback: Proxy
  const proxyUrl = `${PROXY_BASE}${encodeURIComponent(url)}`;
  try {
    const res = await fetch(proxyUrl, options);
    return res;
  } catch (e) {
    console.error("[WorldLabs] Proxy fetch also failed:", e);
    throw e;
  }
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

  if (!res.ok) throw new Error(`Generation trigger failed: ${await getErrorDetails(res)}`);
  return res.json();
}

async function pollOperation(operationId: string, onStatusUpdate: (msg: string) => void) {
  const startTime = Date.now();
  const maxTime = 20 * 60 * 1000; 

  while (Date.now() - startTime < maxTime) {
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    const timeStr = `${minutes}m ${seconds}s`;

    onStatusUpdate(`Constructing Reality... (${timeStr} elapsed)`);
    
    let res;
    try {
        const endpoint = `/operations/${operationId}?t=${Date.now()}`;
        res = await fetchWithProxy(endpoint, {
            method: 'GET',
            headers: { 'WLT-Api-Key': WORLD_LABS_API_KEY }
        });
    } catch (e) {
        console.warn("Polling network error, retrying...", e);
        await wait(5000);
        continue;
    }

    if (!res.ok) {
        if (res.status === 404 || res.status === 522 || res.status === 502) {
             // 404 means not ready yet in some APIs, or actually missing. 
             // 522/502 are server/proxy errors, likely transient. Retry.
             await wait(5000);
             continue;
        }
        throw new Error(`Polling failed: ${await getErrorDetails(res)}`);
    }
    
    // Check if response is JSON
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("text/html")) {
        // Proxy returned HTML error despite status 200 (rare but happens with some captive portals/proxies)
        console.warn("Received HTML instead of JSON during polling, retrying...");
        await wait(5000);
        continue;
    }

    let data;
    try {
        data = await res.json();
    } catch (e) {
        throw new Error("Invalid JSON response from server");
    }
    
    if (data.done) {
      if (data.error) {
        throw new Error(`Generation logic error: ${JSON.stringify(data.error)}`);
      }
      return data.response;
    }
    
    if (data.metadata?.progress?.description) {
         // Optionally update status with detailed description
    }

    await wait(10000);
  }
  throw new Error("Generation timed out.");
}

export const generateWorldFromText = async (
  theme: string,
  setStatus: (msg: string) => void
): Promise<{ splatUrl: string; panoUrl?: string; colliderUrl?: string; imageUrl: string; webUrl?: string }> => {
  try {
    setStatus("Initiating World Protocol...");
    
    const operation = await startGeneration(theme);
    const operationId = operation.operation_id;
    console.log("Operation started:", operationId);

    const worldData = await pollOperation(operationId, setStatus);
    console.log("World Generation Complete:", worldData);

    const assets = worldData.assets || {};
    const splats = assets.splats || {};
    const spzUrls = splats.spz_urls || {}; // Specific structure from user prompt
    const mesh = assets.mesh || {};
    const imagery = assets.imagery || {};
    const links = worldData.links || {};
    
    // 1. Splats: Prefer .splat if available (rare in Marble), else fallback to .spz logic
    // Even if we can't render .spz natively, we pass it through so the UI can decide (or fallback)
    let splatUrl = "";
    
    // Check for standard splat extension first in any flat keys
    const allSplatValues = Object.values(splats);
    const standardSplat = allSplatValues.find((v: any) => typeof v === 'string' && v.endsWith('.splat'));
    
    if (standardSplat) {
        splatUrl = standardSplat as string;
    } else {
        // Fallback to spz (High Quality > Full Res > Low Quality)
        splatUrl = spzUrls['500k'] || spzUrls.full_res || spzUrls['100k'] || "";
        
        // Try top level fallback
        if (!splatUrl && splats['500k']) splatUrl = splats['500k'];
    }

    // 2. Aux Assets
    const panoUrl = imagery.pano_url;
    const colliderUrl = mesh.collider_mesh_url;
    const imageUrl = assets.thumbnail_url || imagery.pano_url || "";
    const webUrl = links.web || "";

    if (!splatUrl && !panoUrl && !imageUrl) {
        throw new Error("Resulting world object missing content");
    }

    return { splatUrl, panoUrl, colliderUrl, imageUrl, webUrl };

  } catch (error) {
    console.error("World Labs Pipeline Error:", error);
    throw error;
  }
};