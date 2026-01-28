import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Sparkles, Float } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';
import { generateWorldFromText } from '../services/worldLabsService';
import { generateWorldImage } from '../services/geminiService';
import { DOOR_POSITION_Z, INTERACTION_DISTANCE, WORLD_THEMES, HALLWAY_LENGTH } from '../constants';
import { GameState } from '../types';

export const HallwayScene: React.FC = () => {
  const setGameState = useStore((state) => state.setGameState);
  const setStatusMessage = useStore((state) => state.setStatusMessage);
  const setCurrentWorld = useStore((state) => state.setCurrentWorld);
  const { camera } = useThree();
  const doorRef = useRef<THREE.Group>(null);
  const portalRingRef = useRef<THREE.Mesh>(null);
  const isGenerating = useRef(false);

  // Initialize camera position for hallway
  React.useEffect(() => {
    camera.position.set(0, 1.6, 5);
    camera.lookAt(0, 1.6, -20);
  }, [camera]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    // Animate Portal Ring
    if (portalRingRef.current) {
        portalRingRef.current.rotation.z = time * 0.5;
        portalRingRef.current.scale.setScalar(1 + Math.sin(time * 2) * 0.05);
    }

    if (isGenerating.current) return;

    if (doorRef.current) {
      // Calculate 2D distance (XZ plane) to ignore player height differences
      const dx = camera.position.x - doorRef.current.position.x;
      const dz = camera.position.z - doorRef.current.position.z;
      const distXZ = Math.sqrt(dx * dx + dz * dz);
      
      // Check if player walked into the door
      if (distXZ < INTERACTION_DISTANCE) {
        triggerGeneration();
      }
    }
  });

  const triggerGeneration = async () => {
    isGenerating.current = true;
    setGameState(GameState.GENERATING);
    // Updated Loading Message as requested
    setStatusMessage("Entering a brand new world...");
    
    const randomTheme = WORLD_THEMES[Math.floor(Math.random() * WORLD_THEMES.length)];
    const worldId = Date.now().toString();

    // Direct Text-to-3D Generation (World Labs)
    let worldResult: { splatUrl: string; panoUrl?: string; colliderUrl?: string; imageUrl: string; webUrl?: string } = { 
        splatUrl: "", imageUrl: "", webUrl: "" 
    };
    
    try {
      worldResult = await generateWorldFromText(randomTheme, (msg) => setStatusMessage(msg));
    } catch (error: any) {
      console.warn("World Labs unavailable, attempting fallback:", error);
      
      // Fallback to Gemini 3 Pro Image Generation
      try {
          setStatusMessage("Connection to World Labs unstable. Rerouting to Gemini Dream Stream...");
          const imageUrl = await generateWorldImage(randomTheme);
          
          worldResult = {
              splatUrl: "",
              imageUrl: imageUrl,
              webUrl: ""
          };
      } catch (geminiError: any) {
          console.error("World Generation failed completely:", geminiError);
          setStatusMessage(`Reality Construction Failed: ${geminiError.message || 'Unknown error'}`);
          setGameState(GameState.ERROR);
          isGenerating.current = false;
          return;
      }
    }
    
    // Enter World
    setCurrentWorld({
      id: worldId,
      theme: randomTheme,
      splatUrl: worldResult.splatUrl,
      panoUrl: worldResult.panoUrl,
      colliderUrl: worldResult.colliderUrl,
      imageUrl: worldResult.imageUrl || "", 
      webUrl: worldResult.webUrl
    });
    
    setStatusMessage("Materializing...");
    
    setTimeout(() => {
        setGameState(GameState.EXPLORING);
        isGenerating.current = false;
    }, 1000);
  };

  return (
    <group>
      <ambientLight intensity={0.8} />
      {/* Fun colorful lights to make it bright and creative */}
      <pointLight position={[2, 4, 0]} intensity={1.5} color="#ff00ff" distance={15} />
      <pointLight position={[-2, 4, -8]} intensity={1.5} color="#00ffff" distance={15} />
      <pointLight position={[2, 4, -16]} intensity={1.5} color="#ffff00" distance={15} />

      {/* Floor - Glossy Reflective */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -HALLWAY_LENGTH/2]}>
        <planeGeometry args={[12, HALLWAY_LENGTH * 2]} />
        <meshPhysicalMaterial 
            color="#ffffff" 
            roughness={0.1} 
            metalness={0.1} 
            transmission={0.1}
        />
      </mesh>

      {/* Ceiling - Starry/Dark blue contrast */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 6, -HALLWAY_LENGTH/2]}>
        <planeGeometry args={[12, HALLWAY_LENGTH * 2]} />
        <meshStandardMaterial color="#0a0a2a" emissive="#110033" />
      </mesh>

      {/* Walls - Creative Arches with neon strips */}
      {Array.from({ length: 8 }).map((_, i) => (
          <group key={i} position={[0, 0, -i * 4 + 2]}>
               {/* Left Pillar */}
               <mesh position={[-5, 3, 0]}>
                   <boxGeometry args={[1, 6, 1]} />
                   <meshStandardMaterial color="#eeeeee" />
               </mesh>
               {/* Right Pillar */}
               <mesh position={[5, 3, 0]}>
                   <boxGeometry args={[1, 6, 1]} />
                   <meshStandardMaterial color="#eeeeee" />
               </mesh>
               {/* Overhead Arch Beam */}
               <mesh position={[0, 5.5, 0]}>
                   <boxGeometry args={[11, 1, 1]} />
                   <meshStandardMaterial color="#cccccc" />
               </mesh>
               {/* Glowing Neon Strip */}
               <mesh position={[0, 5, 0]}>
                   <boxGeometry args={[10, 0.1, 0.1]} />
                   <meshStandardMaterial color="#fff" emissive={i % 2 === 0 ? "#ff00ff" : "#00ffff"} emissiveIntensity={2} />
               </mesh>
          </group>
      ))}

      {/* Magic Particles floating in the hallway */}
      <Sparkles 
        count={200} 
        scale={[10, 6, 30]} 
        size={4} 
        speed={0.5} 
        opacity={0.6} 
        color="#fff" 
        position={[0, 3, -10]}
      />

      {/* The Portal */}
      <group ref={doorRef} position={[0, 0, DOOR_POSITION_Z]}>
        
        {/* Portal Spinning Ring */}
        <mesh ref={portalRingRef} position={[0, 2.5, 0]}>
             <torusGeometry args={[2.8, 0.15, 16, 100]} />
             <meshStandardMaterial color="#ffd700" emissive="#ffaa00" emissiveIntensity={1} />
        </mesh>

        {/* Portal Glow Background */}
        <mesh position={[0, 2.5, 0]}>
           <circleGeometry args={[2.5, 32]} />
           <meshBasicMaterial color="#000000" />
        </mesh>
        
        {/* Inner Vortex */}
        <mesh position={[0, 2.5, 0.05]}>
          <circleGeometry args={[2.2, 32]} />
          <meshStandardMaterial 
            color="#00ffff"
            emissive="#aa00ff"
            emissiveIntensity={2}
            roughness={0}
            metalness={1}
          />
        </mesh>

        {/* Portal Particles / Effects */}
        <Sparkles 
            count={50} 
            scale={[3, 3, 1]} 
            position={[0, 2.5, 0.2]} 
            size={10} 
            speed={2} 
            color="#ffffff" 
        />

        {/* Floating Sign */}
        <Float speed={2} rotationIntensity={0.1} floatIntensity={0.5}>
            <Text 
                position={[0, 6, 0]} 
                fontSize={0.6} 
                color="#ffffff" 
                anchorX="center" 
                anchorY="middle"
                font="https://fonts.gstatic.com/s/raleway/v14/1Ptrg8zYS_SKggPNwK4vaqI.woff"
            >
              explore new worlds
            </Text>
        </Float>
      </group>
    </group>
  );
};