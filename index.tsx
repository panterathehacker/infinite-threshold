import React, { Suspense, useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Splat, Text, PointerLockControls, Loader, Grid, Environment, Float, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { create } from 'zustand';
import { GoogleGenAI } from "@google/genai";

// --- Types ---
export enum GameState {
  LOBBY = 'LOBBY',
  HALLWAY = 'HALLWAY',
  GENERATING = 'GENERATING',
  EXPLORING = 'EXPLORING',
  ERROR = 'ERROR'
}

export interface WorldData {
  id: string;
  theme: string;
  splatUrl: string;
  imageUrl?: string;
}

// --- Constants ---
const WORLD_LABS_API_KEY = "dC2M8VfyOFwciVXZ88ZzMiTXDSs4oE3W";
const API_BASE = "https://api.worldlabs.ai/marble/v1";
const PROXY_1 = "https://corsproxy.io/?";
const PROXY_2 = "https://api.allorigins.win/raw?url=";

const WORLD_THEMES = [
  "Neon Cyberpunk Marketplace",
  "Ancient Overgrown Jungle Temple",
  "Floating Lavender Sky Islands",
  "Steampunk Alchemist Laboratory",
  "Bioluminescent Deep Sea City",
  "Mars Red Desert Outpost",
  "Gothic Cathedral in the Clouds",
  "Surreal Clockwork Desert",
  "Medieval Floating Castle",
  "Solarpunk Greenhouse City"
];

const DOOR_POSITION_Z = -15;
const WORLD_BOUNDS_RADIUS = 30;

// --- Store ---
interface AppState {
  gameState: GameState;
  statusMessage: string;
  currentWorld: WorldData | null;
  setGameState: (state: GameState) => void;
  setStatusMessage: (msg: string) => void;
  setCurrentWorld: (world: WorldData) => void;
  resetToHallway: () => void;
}

const useStore = create<AppState>((set) => ({
  gameState: GameState.LOBBY,
  statusMessage: "Initializing Threshold...",
  currentWorld: null,
  setGameState: (state) => set({ gameState: state }),
  setStatusMessage: (msg) => set({ statusMessage: msg }),
  setCurrentWorld: (world) => set({ currentWorld: world }),
  resetToHallway: () => set({ 
    gameState: GameState.HALLWAY, 
    statusMessage: "",
    currentWorld: null 
  }),
}));

// --- Utilities & Services ---
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithProxy(endpoint: string, options: RequestInit) {
  const url = `${API_BASE}${endpoint}`;
  console.log(`[WorldLabs] Fetching: ${url}`, { method: options.method });
  
  try {
    const res = await fetch(url, options);
    if (res.ok) return res;
  } catch (e) {
    console.warn(`[WorldLabs] Direct fetch failed, trying proxy...`);
  }
  
  try {
    const res = await fetch(`${PROXY_1}${encodeURIComponent(url)}`, options);
    if (res.ok) return res;
  } catch (e) {}
  
  return await fetch(`${PROXY_2}${encodeURIComponent(url)}`, options);
}

async function smartFetchBlob(targetUrl: string): Promise<Blob> {
    try {
        const res = await fetch(targetUrl);
        if (res.ok) {
            const blob = await res.blob();
            if (blob.size > 2000 && !blob.type.includes('html')) return blob;
        }
    } catch (e) {}
    try {
        const res = await fetch(`${PROXY_1}${encodeURIComponent(targetUrl)}`);
        if (res.ok) {
            const blob = await res.blob();
            if (blob.size > 2000 && !blob.type.includes('html')) return blob;
        }
    } catch (e) {}
    const res = await fetch(`${PROXY_2}${encodeURIComponent(targetUrl)}`);
    if (!res.ok) throw new Error("Connection timed out");
    const blob = await res.blob();
    return blob;
}

function findUrlByExtension(obj: any, ext: string): string | null {
  if (!obj) return null;
  if (typeof obj === 'string' && obj.toLowerCase().includes(ext.toLowerCase())) return obj;
  if (typeof obj === 'object') {
    for (const key in obj) {
      const found = findUrlByExtension(obj[key], ext);
      if (found) return found;
    }
  }
  return null;
}

const generateWorld = async (theme: string, setStatus: (msg: string) => void): Promise<WorldData> => {
  setStatus("Imagining 2D Concept...");
  // Always use new GoogleGenAI({ apiKey: process.env.API_KEY }) right before call
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const geminiResponse = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts: [{ text: `A first-person view of ${theme}, immersive, cinematic lighting, 8k.` }] },
    config: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } }
  });

  let base64Image = "";
  for (const part of geminiResponse.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      base64Image = part.inlineData.data;
      break;
    }
  }

  setStatus("Chaining to 3D Geometry...");
  
  // TRIPLE CHECKED WORLD LABS PAYLOAD
  // display_name: Title of the world
  // world_prompt: Contains either image_prompt or text_prompt
  const worldPayload = {
    display_name: theme.substring(0, 30),
    world_prompt: base64Image ? {
      image_prompt: {
        image: {
          image_bytes: base64Image,
          mime_type: "image/png"
        }
      }
    } : {
      text_prompt: `A high quality 3D explorable world of ${theme}, immersive, cinematic.`
    }
  };

  console.log("[WorldLabs] Sending Generation Request:", worldPayload);

  const startRes = await fetchWithProxy(`/worlds:generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'WLT-Api-Key': WORLD_LABS_API_KEY },
    body: JSON.stringify(worldPayload)
  });

  if (!startRes.ok) {
    const errText = await startRes.text();
    console.error("[WorldLabs] Start Generation Error:", errText);
    throw new Error(`3D Sync Failed: ${startRes.status}`);
  }

  const { operation_id } = await startRes.json();
  console.log(`[WorldLabs] Operation ID: ${operation_id}`);
  
  const startTime = Date.now();
  while (Date.now() - startTime < 15 * 60 * 1000) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    setStatus(`Materializing Reality... (${elapsed}s)`);
    
    const pollRes = await fetchWithProxy(`/operations/${operation_id}?t=${Date.now()}`, {
        method: 'GET',
        headers: { 'WLT-Api-Key': WORLD_LABS_API_KEY }
    });

    if (pollRes.ok) {
        const data = await pollRes.json();
        if (data.done) {
            if (data.error) throw new Error(`Neural Breakdown: ${data.error.message || "Unknown error"}`);
            const response = data.response;
            const splat = findUrlByExtension(response, '.spz') || findUrlByExtension(response, '.ply');
            const thumb = findUrlByExtension(response, 'thumbnail') || findUrlByExtension(response, '.webp');
            
            return {
                id: operation_id,
                theme: theme,
                splatUrl: splat || "",
                imageUrl: thumb || (base64Image ? `data:image/png;base64,${base64Image}` : "")
            };
        }
    }
    await wait(10000);
  }
  throw new Error("Reality Construction Timed Out");
};

// --- Components ---

const PlayerController: React.FC = () => {
  const { camera } = useThree();
  const gameState = useStore((state) => state.gameState);
  const move = useRef({ forward: false, backward: false, left: false, right: false });
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());

  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyW') move.current.forward = true;
      if (e.code === 'KeyS') move.current.backward = true;
      if (e.code === 'KeyA') move.current.left = true;
      if (e.code === 'KeyD') move.current.right = true;
    };
    const handleUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyW') move.current.forward = false;
      if (e.code === 'KeyS') move.current.backward = false;
      if (e.code === 'KeyA') move.current.left = false;
      if (e.code === 'KeyD') move.current.right = false;
    };
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => { window.removeEventListener('keydown', handleDown); window.removeEventListener('keyup', handleUp); };
  }, []);

  useFrame((state, delta) => {
    if (gameState === GameState.LOBBY || gameState === GameState.GENERATING || gameState === GameState.ERROR) return;

    velocity.current.x -= velocity.current.x * 10.0 * delta;
    velocity.current.z -= velocity.current.z * 10.0 * delta;

    direction.current.z = Number(move.current.forward) - Number(move.current.backward);
    direction.current.x = Number(move.current.right) - Number(move.current.left);
    direction.current.normalize();

    if (move.current.forward || move.current.backward) velocity.current.z -= direction.current.z * 40.0 * delta;
    if (move.current.left || move.current.right) velocity.current.x -= direction.current.x * 40.0 * delta;

    camera.translateX(-velocity.current.x * delta);
    camera.translateZ(-velocity.current.z * delta);
    camera.position.y = 1.6;

    if (gameState === GameState.EXPLORING) {
      const dist = Math.sqrt(camera.position.x ** 2 + camera.position.z ** 2);
      if (dist > WORLD_BOUNDS_RADIUS) {
        camera.position.setLength(WORLD_BOUNDS_RADIUS - 0.5);
        camera.position.y = 1.6;
      }
    } else if (gameState === GameState.HALLWAY) {
      camera.position.x = Math.max(-4, Math.min(4, camera.position.x));
    }
  });

  return <PointerLockControls />;
};

const HallwayScene: React.FC = () => {
  const { setGameState, setStatusMessage, setCurrentWorld } = useStore();
  const { camera } = useThree();
  const isTriggered = useRef(false);

  useEffect(() => {
    camera.position.set(0, 1.6, 5);
    camera.lookAt(0, 1.6, -20);
  }, [camera]);

  useFrame(() => {
    if (isTriggered.current) return;
    if (camera.position.z < DOOR_POSITION_Z + 1.5 && Math.abs(camera.position.x) < 2) {
      isTriggered.current = true;
      startProcess();
    }
  });

  const startProcess = async () => {
    setGameState(GameState.GENERATING);
    try {
      const theme = WORLD_THEMES[Math.floor(Math.random() * WORLD_THEMES.length)];
      const world = await generateWorld(theme, setStatusMessage);
      setCurrentWorld(world);
      setGameState(GameState.EXPLORING);
    } catch (e: any) {
      setStatusMessage(e.message || "Threshold Error");
      setGameState(GameState.ERROR);
    }
  };

  return (
    <group>
      <Suspense fallback={<pointLight position={[0, 2, -5]} intensity={5} color="cyan" />}>
        {/* Fix: removed non-existent 'intensity' prop to resolve TypeScript error */}
        <Environment preset="city" />
      </Suspense>

      <Grid position={[0, -0.01, -10]} args={[100, 100]} cellColor="#111" sectionColor="#333" sectionSize={5} fadeDistance={40} />
      
      {/* Hallway Geometries with higher visibility */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -10]}>
        <planeGeometry args={[10, 40]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.1} metalness={0.9} />
      </mesh>
      
      <mesh position={[-5, 2, -10]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[40, 4]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[5, 2, -10]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[40, 4]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      
      <group position={[0, 0, DOOR_POSITION_Z]}>
        <mesh position={[0, 2, -0.1]}>
          <planeGeometry args={[3, 4]} />
          <meshBasicMaterial color="#00ffff" transparent opacity={0.2} />
        </mesh>
        <Sparkles count={50} scale={[3, 4, 1]} size={2} speed={0.5} color="#00ffff" />
        <Text position={[0, 4.5, 0.5]} fontSize={0.3} color="white">STEP INTO THE PORTAL</Text>
      </group>

      <pointLight position={[0, 3.5, 0]} intensity={20} color="#00ffff" />
      <pointLight position={[0, 3.5, -15]} intensity={30} color="#00ffff" />
    </group>
  );
};

const WorldScene: React.FC = () => {
  const { currentWorld, resetToHallway } = useStore();
  const [splatSrc, setSplatSrc] = useState<string | null>(null);
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!currentWorld?.splatUrl && !currentWorld?.imageUrl) { setErr(true); return; }
    let active = true;
    let splatUrlObj: string | null = null;
    let texUrlObj: string | null = null;

    const load = async () => {
      setLoading(true);
      try {
        if (currentWorld?.splatUrl) {
            const splatBlob = await smartFetchBlob(currentWorld.splatUrl);
            if (active) {
              splatUrlObj = URL.createObjectURL(splatBlob);
              setSplatSrc(splatUrlObj);
            }
        }
        
        if (currentWorld?.imageUrl) {
          const texUrl = currentWorld.imageUrl.startsWith('data:') ? currentWorld.imageUrl : null;
          if (texUrl) {
            const loader = new THREE.TextureLoader();
            const t = await loader.loadAsync(texUrl);
            if (active) setTex(t);
          } else {
            const texBlob = await smartFetchBlob(currentWorld.imageUrl);
            if (active) {
              texUrlObj = URL.createObjectURL(texBlob);
              const loader = new THREE.TextureLoader();
              const t = await loader.loadAsync(texUrlObj);
              setTex(t);
            }
          }
        }
      } catch (e) {
        console.error("3D Materialization Failure:", e);
        if (active) setErr(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { 
      active = false; 
      if (splatUrlObj) URL.revokeObjectURL(splatUrlObj);
      if (texUrlObj) URL.revokeObjectURL(texUrlObj);
    };
  }, [currentWorld]);

  if (!currentWorld) return null;

  return (
    <group>
      <Suspense fallback={<pointLight position={[0, 5, 0]} intensity={10} color="white" />}>
        <Environment preset="night" />
      </Suspense>

      <Grid position={[0, -0.01, 0]} args={[100, 100]} cellColor="#111" sectionColor="#222" sectionSize={10} fadeDistance={60} />

      {splatSrc && !err ? (
        <group position={[0, -0.5, 0]}>
          <Splat src={splatSrc} scale={1.8} />
        </group>
      ) : (
        <group position={[0, 0, -20]}>
          {tex && (
            <mesh position={[0, 8, 0]}>
              <planeGeometry args={[40, 40]} />
              <meshBasicMaterial map={tex} side={THREE.DoubleSide} transparent opacity={0.8} />
            </mesh>
          )}
          <Text position={[0, 2, 5]} fontSize={1} color={err ? "red" : "white"}>
            {loading ? "MATERIALIZING..." : (err ? "LINK UNSTABLE" : "")}
          </Text>
        </group>
      )}

      {/* Return Orb */}
      <Float speed={2} rotationIntensity={1} floatIntensity={1}>
        <group position={[0, 1.5, 10]} onClick={resetToHallway}>
          <mesh>
            <sphereGeometry args={[0.6, 32, 32]} />
            <meshPhysicalMaterial transmission={1} thickness={2} roughness={0} color="#00ffff" emissive="#00ffff" emissiveIntensity={3} />
          </mesh>
          <Text position={[0, 1.5, 0]} fontSize={0.25} color="white">TOUCH TO RETURN</Text>
        </group>
      </Float>
      
      <ambientLight intensity={1.5} />
      <pointLight position={[0, 10, 0]} intensity={30} />
    </group>
  );
};

const UIOverlay: React.FC = () => {
  const { gameState, statusMessage, resetToHallway } = useStore();

  if (gameState === GameState.LOBBY) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-50 flex flex-col items-center justify-between p-10 font-mono">
      <div className="w-full flex justify-between items-start">
        <div className="bg-black/60 backdrop-blur-2xl p-6 rounded-2xl border border-white/10 text-white shadow-2xl">
          <h1 className="text-2xl font-black tracking-widest text-cyan-400">INFINITE THRESHOLD</h1>
          <p className="text-[10px] opacity-50">SYNC: {gameState}</p>
        </div>
      </div>

      {(gameState === GameState.HALLWAY || gameState === GameState.EXPLORING) && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/60 rounded-full shadow-[0_0_10px_white]"></div>
      )}

      {gameState === GameState.GENERATING && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center text-white pointer-events-auto">
          <div className="relative w-24 h-24 mb-12">
            <div className="absolute inset-0 border-4 border-cyan-500/10 rounded-full animate-pulse"></div>
            <div className="absolute inset-0 border-t-4 border-cyan-400 rounded-full animate-spin"></div>
          </div>
          <h2 className="text-3xl tracking-widest uppercase text-cyan-400 animate-pulse">{statusMessage}</h2>
        </div>
      )}

      {gameState === GameState.ERROR && (
        <div className="absolute inset-0 bg-red-950/95 backdrop-blur-3xl flex flex-col items-center justify-center text-white pointer-events-auto">
          <h2 className="text-5xl font-black mb-6 text-red-500">LINK FAILED</h2>
          <p className="text-xl mb-16 opacity-70">{statusMessage}</p>
          <button onClick={resetToHallway} className="px-12 py-4 border border-white/10 bg-white/5 text-white hover:bg-white hover:text-black transition-all uppercase tracking-widest">Restart</button>
        </div>
      )}

      <div className="mb-6 bg-black/80 px-10 py-4 rounded-full border border-white/5 backdrop-blur-3xl text-[10px] text-white/40 uppercase tracking-[0.4em]">
        {gameState === GameState.HALLWAY ? "WASD to Move / Portal for New World" : "Explore / Return via Orb"}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const { gameState, setGameState } = useStore();

  useEffect(() => {
    const checkKey = async () => {
       if ((window as any).aistudio && await (window as any).aistudio.hasSelectedApiKey()) {
           setGameState(GameState.HALLWAY);
       }
    };
    checkKey();
  }, []);

  if (gameState === GameState.LOBBY) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white p-6">
        <div className="max-w-xl text-center bg-white/5 p-16 rounded-[4rem] border border-white/10">
          <h1 className="text-7xl font-black mb-12 tracking-tighter">THRESHOLD</h1>
          <button onClick={() => (window as any).aistudio.openSelectKey().then(() => setGameState(GameState.HALLWAY))} className="w-full py-6 bg-white text-black font-black uppercase tracking-widest hover:bg-cyan-400 transition-all">
            Enter Dimension
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-black">
      <UIOverlay />
      <Canvas shadows camera={{ fov: 75, near: 0.1, far: 2000 }}>
        <ambientLight intensity={1.0} />
        <Suspense fallback={null}>
          <fog attach="fog" args={['#000', 10, 150]} />
          {(gameState === GameState.HALLWAY || gameState === GameState.GENERATING) && <HallwayScene />}
          {gameState === GameState.EXPLORING && <WorldScene />}
          <PlayerController />
        </Suspense>
      </Canvas>
      <Loader />
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);