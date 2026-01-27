import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';
import { generateWorldImage } from '../services/geminiService';
import { generateSplatFromImage } from '../services/worldLabsService';
import { DOOR_POSITION_Z, INTERACTION_DISTANCE, WORLD_THEMES, HALLWAY_LENGTH } from '../constants';
import { GameState } from '../types';

export const HallwayScene: React.FC = () => {
  const setGameState = useStore((state) => state.setGameState);
  const setStatusMessage = useStore((state) => state.setStatusMessage);
  const setCurrentWorld = useStore((state) => state.setCurrentWorld);
  const { camera } = useThree();
  const doorRef = useRef<THREE.Group>(null);
  const isGenerating = useRef(false);

  // Initialize camera position for hallway
  React.useEffect(() => {
    camera.position.set(0, 1.6, 5);
    camera.lookAt(0, 1.6, -20);
  }, [camera]);

  useFrame(() => {
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
    
    const randomTheme = WORLD_THEMES[Math.floor(Math.random() * WORLD_THEMES.length)];
    const worldId = Date.now().toString();
    let base64Image = "";

    // 1. Dream (Image Gen)
    try {
      setStatusMessage(`Dreaming of ${randomTheme}...`);
      base64Image = await generateWorldImage(randomTheme);
    } catch (error: any) {
      console.error("Gemini Error:", error);
      setStatusMessage(`Neural Link Failed: ${error.message || "Unknown Error"}`);
      setGameState(GameState.ERROR);
      isGenerating.current = false;
      return;
    }

    // 2. Reality (Splat Gen) - With Fallback
    let splatUrl = "";
    try {
      // We pass setStatusMessage so the service can update the UI during the long upload/poll process
      splatUrl = await generateSplatFromImage(base64Image, randomTheme, (msg) => setStatusMessage(msg));
    } catch (error: any) {
      console.warn("World Labs generation failed, falling back to 2D:", error);
      setStatusMessage(`Reality Construction Failed: ${error.message}. Fallback initialized.`);
      await new Promise(r => setTimeout(r, 2000)); // Pause to let user read
    }
    
    // 3. Enter
    setCurrentWorld({
      id: worldId,
      theme: randomTheme,
      splatUrl: splatUrl,
      imageUrl: `data:image/png;base64,${base64Image}`
    });
    
    setStatusMessage("Materializing...");
    
    setTimeout(() => {
        setGameState(GameState.EXPLORING);
        isGenerating.current = false;
    }, 1000);
  };

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -HALLWAY_LENGTH/2]}>
        <planeGeometry args={[10, HALLWAY_LENGTH * 2]} />
        <meshStandardMaterial color="#202020" roughness={0.2} metalness={0.8} />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 4, -HALLWAY_LENGTH/2]}>
        <planeGeometry args={[10, HALLWAY_LENGTH * 2]} />
        <meshStandardMaterial color="#101010" />
      </mesh>

      {/* Walls */}
      <mesh position={[-5, 2, -HALLWAY_LENGTH/2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[HALLWAY_LENGTH * 2, 4]} />
        <meshStandardMaterial color="#f0f0f0" />
      </mesh>
      <mesh position={[5, 2, -HALLWAY_LENGTH/2]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[HALLWAY_LENGTH * 2, 4]} />
        <meshStandardMaterial color="#f0f0f0" />
      </mesh>

      {/* Lights */}
      <pointLight position={[0, 3.5, 0]} intensity={0.5} />
      <pointLight position={[0, 3.5, -10]} intensity={0.5} />
      <pointLight position={[0, 3.5, -20]} intensity={0.5} />

      {/* The Door */}
      <group ref={doorRef} position={[0, 0, DOOR_POSITION_Z]}>
        {/* Frame */}
        <mesh position={[0, 2, 0]}>
          <boxGeometry args={[3, 4, 0.2]} />
          <meshStandardMaterial color="#000" />
        </mesh>
        
        {/* Portal Surface */}
        <mesh position={[0, 2, 0.11]}>
          <planeGeometry args={[2.5, 3.5]} />
          <meshBasicMaterial color="#00ffff" toneMapped={false}>
             {/* Simple pulse effect via shader could go here, for now basic color */}
          </meshBasicMaterial>
        </mesh>

        {/* Text Prompt */}
        <Text 
            position={[0, 4.5, 0.5]} 
            fontSize={0.4} 
            color="white" 
            anchorX="center" 
            anchorY="middle"
        >
          STEP INTO THE UNKNOWN
        </Text>
      </group>
    </group>
  );
};