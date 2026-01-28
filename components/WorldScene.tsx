import React, { useEffect, useState } from 'react';
import { Splat, Text, Gltf } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { DoubleSide, TextureLoader, Texture, BackSide, MeshStandardMaterial } from 'three';
import { useStore } from '../store';

// Use a public CORS proxy to bypass browser-side CORS restrictions for the Splat file
const PROXY_BASE = "https://corsproxy.io/?";

export const WorldScene: React.FC = () => {
  const currentWorld = useStore((state) => state.currentWorld);
  const resetToHallway = useStore((state) => state.resetToHallway);
  const { camera } = useThree();
  
  const [splatSrc, setSplatSrc] = useState<string | null>(null);
  const [panoTexture, setPanoTexture] = useState<Texture | null>(null);
  const [colliderSrc, setColliderSrc] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [mode, setMode] = useState<'SPLAT' | 'MESH' | 'PANO' | 'FALLBACK'>('FALLBACK');

  useEffect(() => {
    // Reset camera when entering world
    camera.position.set(0, 1.6, 0); 
    camera.lookAt(0, 1.6, -4);
  }, [camera, currentWorld]);

  useEffect(() => {
    if (!currentWorld) return;

    const { splatUrl, panoUrl, colliderUrl, imageUrl } = currentWorld;

    const loadContent = async () => {
        setIsLoading(true);
        setError(false);
        setSplatSrc(null);
        setPanoTexture(null);
        setColliderSrc(null);

        // STRATEGY: 
        // 1. Try loading Splat (supports .splat and we will try .spz if the loader handles it or we proxy it right)
        // 2. Try loading Collider Mesh (GLB/GLTF)
        // 3. Try loading Pano (360 image)
        // 4. Fallback to Curved Image Plane

        if (splatUrl) {
             try {
                // We do NOT filter out .spz anymore. We try to load it.
                const src = await fetchProxiedBlobUrl(splatUrl);
                setSplatSrc(src);
                setMode('SPLAT');
                setIsLoading(false);
                return;
             } catch (e) {
                console.warn("Splat load failed, trying next method...", e);
             }
        }

        if (colliderUrl) {
            try {
                // Fix: Fetch via proxy to handle CORS for GLB
                const src = await fetchProxiedBlobUrl(colliderUrl);
                setColliderSrc(src); 
                setMode('MESH');
                setIsLoading(false);
                return;
            } catch (e) {
                console.warn("Mesh load failed, trying Pano...", e);
            }
        }

        if (panoUrl) {
            try {
                const tex = await loadTextureProxied(panoUrl);
                setPanoTexture(tex);
                setMode('PANO');
                setIsLoading(false);
                return;
            } catch (e) {
                console.warn("Pano load failed, trying Fallback...", e);
            }
        }

        // Fallback (Gemini Image)
        setMode('FALLBACK');
        setIsLoading(false);
        if (!imageUrl) setError(true);
    };

    loadContent();
  }, [currentWorld]);

  const handleReturn = () => {
    resetToHallway();
  };

  if (!currentWorld) return null;

  return (
    <group>
      {/* 3D Content based on Mode */}
      {mode === 'SPLAT' && splatSrc && (
        <group position={[0, -1.6, 0]}> 
           <Splat src={splatSrc} />
        </group>
      )}

      {mode === 'MESH' && colliderSrc && (
         <group position={[0, -1.6, 0]}>
            <Gltf src={colliderSrc} />
            {/* Render a mesh, assuming it has materials or default to white if lighting allows */}
         </group>
      )}

      {mode === 'PANO' && panoTexture && (
         <mesh position={[0, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <sphereGeometry args={[50, 64, 64]} />
            <meshBasicMaterial map={panoTexture} side={BackSide} />
         </mesh>
      )}

      {mode === 'FALLBACK' && (
        <FallbackCurvedScreen 
           imageUrl={currentWorld.imageUrl} 
           isError={error} 
           isLoading={isLoading} 
        />
      )}

      {/* Return Portal */}
      <group position={[0, 1.6, 4]}> 
        <mesh onClick={handleReturn}>
             <sphereGeometry args={[0.3, 32, 32]} />
             <meshPhysicalMaterial 
                transmission={0.8}
                thickness={1} 
                roughness={0.1} 
                color="#ff00ff" 
                emissive="#aa00aa"
                emissiveIntensity={0.8}
             />
        </mesh>
        <Text 
            position={[0, 0.5, 0]} 
            fontSize={0.15} 
            color="white" 
            anchorX="center" 
            anchorY="middle"
        >
          Return
        </Text>
      </group>
      
      <ambientLight intensity={1} />
    </group>
  );
};

// Helper to fetch blob via proxy and return object URL
async function fetchProxiedBlobUrl(url: string): Promise<string> {
    console.log("Fetching Asset via Proxy:", url);
    let response = await fetch(url).catch(() => null);
    if (!response || !response.ok) {
        // Fallback to proxy
        const proxyUrl = `${PROXY_BASE}${encodeURIComponent(url)}`;
        response = await fetch(proxyUrl);
    }
    if (!response || !response.ok) throw new Error("Fetch failed");
    
    const blob = await response.blob();
    // Basic validation
    if (blob.size < 1000 || blob.type.includes('text') || blob.type.includes('html')) {
        throw new Error("Invalid blob");
    }
    return URL.createObjectURL(blob);
}

// Helper to load texture via proxy
async function loadTextureProxied(url: string): Promise<Texture> {
    console.log("Fetching Pano/Image:", url);
    
    // For data URIs (Gemini), just load directly
    if (url.startsWith('data:')) {
        return new TextureLoader().loadAsync(url);
    }

    let blob: Blob | null = null;
    try {
        const res = await fetch(url);
        if (res.ok) blob = await res.blob();
    } catch (e) {}

    if (!blob) {
        const proxyUrl = `${PROXY_BASE}${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error("Fetch failed");
        blob = await res.blob();
    }
    
    if (!blob || blob.size < 100) throw new Error("Invalid blob");
    
    const objectUrl = URL.createObjectURL(blob);
    return new TextureLoader().loadAsync(objectUrl);
}

const FallbackCurvedScreen: React.FC<{ imageUrl?: string, isError: boolean, isLoading: boolean }> = ({ imageUrl, isError, isLoading }) => {
  const [texture, setTexture] = useState<Texture | null>(null);

  useEffect(() => {
     if (!imageUrl) return;
     let active = true;
     loadTextureProxied(imageUrl).then(tex => {
         if (active) setTexture(tex);
     }).catch(e => console.error(e));
     return () => { active = false; };
  }, [imageUrl]);

  return (
    <group position={[0, 1.6, 0]}>
       {/* Curved Screen Geometry */}
       <mesh position={[0, 0, 0]} rotation={[0, Math.PI, 0]}>
         {/* Cylinder segment: radius=10, height=10, radialSegments=32, heightSegments=1, openEnded, thetaStart, thetaLength */}
         <cylinderGeometry args={[10, 10, 12, 32, 1, true, -Math.PI / 3, 2 * Math.PI / 3]} />
         <meshBasicMaterial 
            map={texture || undefined} 
            color={texture ? "white" : "#202020"} 
            side={DoubleSide} 
            wireframe={!texture}
         />
       </mesh>
       
       {/* Floor hint for immersion if using just an image */}
       <mesh position={[0, -1.6, 0]} rotation={[-Math.PI/2, 0, 0]}>
          <planeGeometry args={[20, 20]} />
          <meshBasicMaterial color="#101010" transparent opacity={0.8} />
       </mesh>

       <Text 
          position={[0, 0, -4]} 
          fontSize={0.3} 
          color={isError ? "#ff3333" : "#ffffff"} 
          anchorX="center" 
          anchorY="middle"
       >
         {isLoading ? "DOWNLOADING REALITY..." : (isError ? "DIMENSION UNSTABLE (2D FALLBACK)" : "")}
       </Text>
    </group>
  );
};