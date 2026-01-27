import React, { useState } from 'react';
import { useStore } from '../store';
import { GameState } from '../types';

export const ApiKeySelector: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const setGameState = useStore((state) => state.setGameState);

  const handleSelectKey = async () => {
    if (!window.aistudio) {
      alert("AI Studio environment not detected. Please run this in the correct environment.");
      return;
    }

    setIsLoading(true);
    try {
      await window.aistudio.openSelectKey();
      // Assume success if no error thrown, proceed to Hallway
      setGameState(GameState.HALLWAY);
    } catch (error) {
      console.error("Failed to select key:", error);
      alert("Failed to select API key. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white p-8">
      <div className="max-w-md w-full bg-white/10 backdrop-blur-lg p-8 rounded-2xl border border-white/20 shadow-2xl text-center">
        <h1 className="text-4xl font-bold mb-2 tracking-tighter">Infinite Threshold</h1>
        <p className="text-gray-300 mb-8">
          Step into an infinite hallway where every door leads to a new reality.
        </p>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            This experience uses Google's <strong>Gemini 3 Pro</strong> for imagination and <strong>World Labs</strong> for reconstruction.
            A valid API key is required to dream.
          </p>
          
          <button
            onClick={handleSelectKey}
            disabled={isLoading}
            className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Connecting...' : 'Enter the Threshold'}
          </button>
          
          <p className="text-xs text-gray-500 mt-4">
            By connecting, you agree to the usage terms of the respective APIs.
            <br />
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-white">
              Billing Information
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};