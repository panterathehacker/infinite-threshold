import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { Vector3 } from 'three';
import { useStore } from '../store';
import { GameState } from '../types';
import { WORLD_BOUNDS_RADIUS } from '../constants';

export const PlayerController: React.FC = () => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const gameState = useStore((state) => state.gameState);
  
  // Movement state
  const moveForward = useRef(false);
  const moveBackward = useRef(false);
  const moveLeft = useRef(false);
  const moveRight = useRef(false);
  const velocity = useRef(new Vector3());
  const direction = useRef(new Vector3());

  // Keyboard listeners
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': moveForward.current = true; break;
        case 'ArrowLeft':
        case 'KeyA': moveLeft.current = true; break;
        case 'ArrowDown':
        case 'KeyS': moveBackward.current = true; break;
        case 'ArrowRight':
        case 'KeyD': moveRight.current = true; break;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': moveForward.current = false; break;
        case 'ArrowLeft':
        case 'KeyA': moveLeft.current = false; break;
        case 'ArrowDown':
        case 'KeyS': moveBackward.current = false; break;
        case 'ArrowRight':
        case 'KeyD': moveRight.current = false; break;
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Unlock cursor when not playing
  useEffect(() => {
    if (gameState === GameState.LOBBY || gameState === GameState.GENERATING || gameState === GameState.ERROR) {
       controlsRef.current?.unlock();
    } else {
       // We can't auto-lock browser pointer without user gesture usually, 
       // but typically clicking on canvas does it.
    }
  }, [gameState]);

  useFrame((state, delta) => {
    if (!controlsRef.current?.isLocked) return;
    if (gameState === GameState.GENERATING) return;

    // Deceleration
    velocity.current.x -= velocity.current.x * 10.0 * delta;
    velocity.current.z -= velocity.current.z * 10.0 * delta;

    // Direction calculation
    direction.current.z = Number(moveForward.current) - Number(moveBackward.current);
    direction.current.x = Number(moveRight.current) - Number(moveLeft.current);
    direction.current.normalize();

    // Acceleration
    if (moveForward.current || moveBackward.current) velocity.current.z -= direction.current.z * 40.0 * delta;
    if (moveLeft.current || moveRight.current) velocity.current.x -= direction.current.x * 40.0 * delta;

    // Apply movement
    controlsRef.current.moveRight(-velocity.current.x * delta);
    controlsRef.current.moveForward(-velocity.current.z * delta);
    
    // Bounds check for Exploring mode
    if (gameState === GameState.EXPLORING) {
        const pos = camera.position;
        const dist = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
        if (dist > WORLD_BOUNDS_RADIUS) {
            // Push back simply
            const angle = Math.atan2(pos.z, pos.x);
            camera.position.x = Math.cos(angle) * WORLD_BOUNDS_RADIUS;
            camera.position.z = Math.sin(angle) * WORLD_BOUNDS_RADIUS;
        }
    }
    
    // Hallway bounds (simple tunnel)
    if (gameState === GameState.HALLWAY) {
        if (camera.position.x > 4) camera.position.x = 4;
        if (camera.position.x < -4) camera.position.x = -4;
    }
  });

  return <PointerLockControls ref={controlsRef} />;
};