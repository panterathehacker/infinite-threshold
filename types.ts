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
  panoUrl?: string;
  colliderUrl?: string;
  imageUrl?: string;
  webUrl?: string;
}

declare global {
  interface AIStudio {
    openSelectKey: () => Promise<void>;
    hasSelectedApiKey: () => Promise<boolean>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}