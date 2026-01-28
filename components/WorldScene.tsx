import React, { useEffect, useState } from 'react';
import { Splat, Text } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { DoubleSide, TextureLoader, Texture } from 'three';
import { useStore } from '../store';

const PROXY_1 = "https://corsproxy.io/?";
const PROXY_2 = "https://api.allorigins.win/raw?url=";

async function smartFetch(targetUrl: string): Promise<Blob> {
    // 1. Direct
    try {
        const res = await fetch(targetUrl);
        if (res.ok) {
            const blob = await res.blob();
            if (blob.size > 2000 && !blob.type.includes('html')) return blob;
        }
    } catch (e) {}

    // 2. Proxy 1
    try {
        const res = await fetch(`${PROXY_1}${encodeURIComponent(targetUrl)}`);
        if (res.ok) {
            const blob = await res.blob();
            if (blob.size > 2000 && !blob.type.includes('html')) return blob;
        }
    } catch (e) {}

    // 3. Proxy 2
    const res = await fetch(`${PROXY_2}${encodeURIComponent(targetUrl)}`);
    if (!res.ok) throw new Error("All fetch attempts failed");
    const blob = await res.blob();
    if (blob.type.includes('html')) throw new Error("Received HTML instead of binary");
    return blob;
}

export const WorldScene: React.FC = () => {
  const currentWorld = useStore((state) => state.currentWorld);
  const resetToHallway = useStore((state) => state.resetToHallway);
  const { camera } = useThree();
  const [splatSrc, setSplatSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    camera.position.set(0, 1.6, 0);
    camera.lookAt(0, 1.6, -1);
  }, [camera, currentWorld]);

  useEffect(() => {
    if (!currentWorld?.splatUrl) {
        if (currentWorld?.imageUrl) setError(true);
        return;
    }

    let active = true;
    let objectUrl: string | null = null;

    const loadSplat = async () => {
      setIsLoading(true);
      setError(false);
      try {
        const blob = await smartFetch(currentWorld.splatUrl);
        if (active) {
           objectUrl = URL.createObjectURL(blob);
           setSplatSrc(objectUrl);
        }
      } catch (err) {
        console.error("Splat Load Error:", err);
        if (active) setError(true);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadSplat();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [currentWorld?.splatUrl]);

  if (!currentWorld) return null;

  return (
    <group>
      {splatSrc && !error ? (
        <group position={[0, -1.6, 0]}> 
           <Splat src={splatSrc} />
        </group>
      ) : (
        <FallbackBillboard 
           imageUrl={currentWorld.imageUrl} 
           isError={error} 
           isLoading={isLoading} 
        />
      )}

      <group position={[0, 0, 4]}> 
        <mesh onClick={resetToHallway} position={[0, 1.5, 0]}>
             <sphereGeometry args={[0.5, 32, 32]} />
             <meshPhysicalMaterial transmission={1} thickness={1} roughness={0} color="#fff" />
        </mesh>
        <Text position={[0, 2.5, 0]} fontSize={0.2} color="white">Return to Hallway</Text>
      </group>
      <ambientLight intensity={1.5} />
    </group>
  );
};

const FallbackBillboard: React.FC<{ imageUrl?: string, isError: boolean, isLoading: boolean }> = ({ imageUrl, isError, isLoading }) => {
  const [texture, setTexture] = useState<Texture | null>(null);

  useEffect(() => {
    if (!imageUrl) return;
    let active = true;
    const load = async () => {
        try {
            const blob = await smartFetch(imageUrl);
            const url = URL.createObjectURL(blob);
            const tex = await new TextureLoader().loadAsync(url);
            if (active) setTexture(tex);
        } catch (e) {
            console.error("Texture Load Error:", e);
        }
    };
    load();
    return () => { active = false; };
  }, [imageUrl]);

  return (
    <group position={[0, 0, 0]}>
       {texture && (
         <mesh position={[0, 1.6, -5]}>
            <planeGeometry args={[12, 12]} />
            <meshBasicMaterial map={texture} side={DoubleSide} />
         </mesh>
       )}
       <Text 
          position={[0, 2, -4.5]} 
          fontSize={0.4} 
          color={isError ? "#ff4444" : "#ffffff"} 
       >
         {isLoading ? "LOADING DIMENSION..." : (isError ? "DIMENSION UNSTABLE (2D VIEW)" : "")}
       </Text>
    </group>
  );
};