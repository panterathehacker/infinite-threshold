import React, { useEffect } from 'react';
import { Splat, Text, useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { DoubleSide } from 'three';
import { useStore } from '../store';

export const WorldScene: React.FC = () => {
  const currentWorld = useStore((state) => state.currentWorld);
  const resetToHallway = useStore((state) => state.resetToHallway);
  const { camera } = useThree();

  useEffect(() => {
    // Reset camera when entering world to spawn point
    camera.position.set(0, 1.6, 0);
    camera.lookAt(0, 1.6, -1);
  }, [camera, currentWorld]);

  const handleReturn = () => {
    resetToHallway();
  };

  if (!currentWorld) return null;

  return (
    <group>
      {/* 3D Content: Either Splat or Fallback Billboard */}
      {currentWorld.splatUrl ? (
        <group position={[0, -1.6, 0]}> 
           <Splat src={currentWorld.splatUrl} />
        </group>
      ) : (
        <FallbackBillboard imageUrl={currentWorld.imageUrl} />
      )}

      {/* Return Portal - Behind spawn */}
      <group position={[0, 0, 4]}> 
        <mesh onClick={handleReturn} position={[0, 1.5, 0]}>
             <sphereGeometry args={[1, 32, 32]} />
             <meshPhysicalMaterial 
                transmission={1}
                thickness={2} 
                roughness={0} 
                ior={1.5}
                color="#ffffff" 
             />
        </mesh>
        <Text 
            position={[0, 3, 0]} 
            fontSize={0.3} 
            color="white" 
            anchorX="center" 
            anchorY="middle"
        >
          Return to Hallway
        </Text>
      </group>
      
      <ambientLight intensity={1} />
    </group>
  );
};

const FallbackBillboard: React.FC<{ imageUrl?: string }> = ({ imageUrl }) => {
  if (!imageUrl) return null;
  const texture = useTexture(imageUrl);
  
  return (
    <group position={[0, 0, 0]}>
       {/* Large curved plane or billboard to display the image */}
       <mesh position={[0, 1.6, -5]} rotation={[0, 0, 0]}>
         <planeGeometry args={[10, 10]} />
         <meshBasicMaterial map={texture} side={DoubleSide} />
       </mesh>
       
       <Text 
          position={[0, 7, -5]} 
          fontSize={0.8} 
          color="#ff3333" 
          anchorX="center" 
          anchorY="middle"
       >
         DIMENSION UNSTABLE (2D FALLBACK)
       </Text>
    </group>
  );
};