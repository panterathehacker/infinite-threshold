import { create } from 'zustand';
import { GameState, WorldData } from './types';

interface AppState {
  gameState: GameState;
  statusMessage: string;
  currentWorld: WorldData | null;
  history: WorldData[];
  
  setGameState: (state: GameState) => void;
  setStatusMessage: (msg: string) => void;
  setCurrentWorld: (world: WorldData) => void;
  resetToHallway: () => void;
}

export const useStore = create<AppState>((set) => ({
  gameState: GameState.LOBBY,
  statusMessage: "Initializing...",
  currentWorld: null,
  history: [],

  setGameState: (state) => set({ gameState: state }),
  setStatusMessage: (msg) => set({ statusMessage: msg }),
  setCurrentWorld: (world) => set((state) => ({ 
    currentWorld: world,
    history: [...state.history, world]
  })),
  resetToHallway: () => set({ 
    gameState: GameState.HALLWAY, 
    statusMessage: "",
    currentWorld: null 
  }),
}));