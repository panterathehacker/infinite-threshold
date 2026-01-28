import React, { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { useStore } from './store';
import { GameState } from './types';
import { ApiKeySelector } from './components/ApiKeySelector';
import { UIOverlay } from './components/UIOverlay';
import { HallwayScene } from './components/HallwayScene';
import { WorldScene } from './components/WorldScene';
import { PlayerController } from './components/PlayerController';

const App: React.FC = () => {
  const gameState = useStore((state) => state.gameState);

  // Initial check for key selection state
  useEffect(() => {
    const checkKey = async () => {
      try {
         if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
             useStore.getState().setGameState(GameState.HALLWAY);
         }
      } catch (e) {
         console.warn("API Key check skipped or failed", e);
      }
    };
    checkKey();
  }, []);

  if (gameState === GameState.LOBBY) {
    return <ApiKeySelector />;
  }

  return (
    <>
      <div className="w-full h-full relative bg-black">
        <UIOverlay />
        
        <Canvas shadows camera={{ fov: 75 }}>
          <Suspense fallback={null}>
            {/* Magical Fog Color */}
            <fog attach="fog" args={['#1a0b2e', 5, 40]} />
            <ambientLight intensity={0.2} />
            
            {/* Conditional Rendering of Scenes */}
            {(gameState === GameState.HALLWAY || gameState === GameState.GENERATING) && <HallwayScene />}
            {(gameState === GameState.EXPLORING) && <WorldScene />}
            
            {/* Player Physics/Controls */}
            <PlayerController />
          </Suspense>
        </Canvas>
      </div>
    </>
  );
};

export default App;