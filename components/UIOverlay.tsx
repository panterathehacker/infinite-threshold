import React from 'react';
import { useStore } from '../store';
import { GameState } from '../types';

export const UIOverlay: React.FC = () => {
  const { gameState, statusMessage, resetToHallway } = useStore();

  if (gameState === GameState.LOBBY) return null; // Handle by ApiKeySelector

  return (
    <div className="absolute inset-0 pointer-events-none z-50 flex flex-col items-center justify-between p-8">
      
      {/* Top HUD */}
      <div className="w-full flex justify-between items-start">
        <div className="bg-black/30 backdrop-blur-md p-4 rounded-lg text-white border border-white/10">
          <h2 className="text-xl font-bold tracking-widest">INFINITE THRESHOLD</h2>
          <p className="text-xs text-gray-400">STATUS: {gameState}</p>
        </div>
      </div>

      {/* Center - Crosshair */}
      {(gameState === GameState.HALLWAY || gameState === GameState.EXPLORING) && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="w-2 h-2 bg-white rounded-full opacity-80 shadow-[0_0_10px_rgba(255,255,255,0.8)]"></div>
        </div>
      )}

      {/* Loading / Generating Screen */}
      {gameState === GameState.GENERATING && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center text-white">
           <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin mb-8"></div>
           <h2 className="text-3xl font-light tracking-widest animate-pulse">{statusMessage}</h2>
           <p className="text-sm text-gray-500 mt-4">Generating neural landscape & spatial geometry...</p>
        </div>
      )}

       {/* Error Screen */}
       {gameState === GameState.ERROR && (
        <div className="absolute inset-0 bg-red-900/50 backdrop-blur-xl flex flex-col items-center justify-center text-white pointer-events-auto">
           <h2 className="text-4xl font-bold mb-4">MEMORY CORRUPTED</h2>
           <p className="text-lg mb-8">{statusMessage}</p>
           <button 
             onClick={resetToHallway}
             className="px-6 py-3 bg-white text-black font-bold rounded hover:bg-gray-200"
           >
             Reboot Simulation
           </button>
        </div>
      )}

      {/* Bottom Instructions */}
      <div className="mb-8 text-center">
         {gameState === GameState.HALLWAY && (
             <p className="text-white/70 text-sm bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm">
                WASD to Move &bull; Mouse to Look &bull; Walk into the portal
             </p>
         )}
          {gameState === GameState.EXPLORING && (
             <p className="text-white/70 text-sm bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm">
                Explore the generated memory &bull; Find the Orb to return
             </p>
         )}
      </div>
    </div>
  );
};