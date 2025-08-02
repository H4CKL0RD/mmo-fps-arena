"use client";

import { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PointerLockControls, Box, Plane } from '@react-three/drei';
import { Euler, Vector3 } from 'three';
import { io, Socket } from 'socket.io-client';

// Helper to get keyboard input
function useKeyboard() {
  const keyMap = useRef<{ [key: string]: boolean }>({});
  useEffect(() => {
    const onDocumentKey = (e: KeyboardEvent) => {
      keyMap.current[e.key.toLowerCase()] = e.type === 'keydown';
    };
    document.addEventListener('keydown', onDocumentKey);
    document.addEventListener('keyup', onDocumentKey);
    return () => {
      document.removeEventListener('keydown', onDocumentKey);
      document.removeEventListener('keyup', onDocumentKey);
    };
  }, []);
  return keyMap;
}

// Player component
function Player({ socket }: { socket: Socket }) {
  const controlsRef = useRef<any>();
  const cameraRef = useRef<any>();
  const keyMap = useKeyboard();
  const moveSpeed = 0.1;

  useFrame((state) => {
    if (!controlsRef.current?.isLocked) return;

    const velocity = new Vector3();
    const direction = new Vector3();

    if (keyMap.current['w']) direction.z = -1;
    if (keyMap.current['s']) direction.z = 1;
    if (keyMap.current['a']) direction.x = -1;
    if (keyMap.current['d']) direction.x = 1;

    if (direction.length() > 0) {
        direction.normalize();
        // Use the camera from the state, which is managed by R3F
        const euler = new Euler(0, state.camera.rotation.y, 0, 'YXZ');
        velocity.copy(direction).applyEuler(euler).multiplyScalar(moveSpeed);
    }
    
    state.camera.position.add(velocity);

    // Send position to server periodically
    socket.emit('playerMove', {
      position: [state.camera.position.x, state.camera.position.y, state.camera.position.z],
      rotation: [state.camera.rotation.x, state.camera.rotation.y, state.camera.rotation.z],
    });
  });

  return <PointerLockControls ref={controlsRef} />;
}

// Component for other players
function OtherPlayer({ player }) {
    return (
        <Box position={player.position} castShadow>
            <meshStandardMaterial color="red" />
        </Box>
    );
}

// Main Game Component
export default function Game() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [otherPlayers, setOtherPlayers] = useState({});

  useEffect(() => {
    const newSocket = io("http://localhost:3001");
    setSocket(newSocket);

    newSocket.on('currentPlayers', (players) => {
        const others = { ...players };
        if (others[newSocket.id!]) {
            delete others[newSocket.id!];
        }
        setOtherPlayers(others);
    });

    newSocket.on('newPlayer', (playerInfo) => {
        setOtherPlayers(prev => ({ ...prev, [playerInfo.id]: playerInfo }));
    });

    newSocket.on('playerMoved', (playerInfo) => {
        setOtherPlayers(prev => ({
            ...prev,
            [playerInfo.id]: { ...prev[playerInfo.id], position: playerInfo.position, rotation: playerInfo.rotation }
        }));
    });

    newSocket.on('playerDisconnected', (id) => {
        setOtherPlayers(prev => {
            const newPlayers = { ...prev };
            delete newPlayers[id];
            return newPlayers;
        });
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', cursor: 'pointer' }}>
        <div id="instructions" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10, color: 'white', backgroundColor: 'rgba(0,0,0,0.7)', padding: '20px', borderRadius: '10px', textAlign: 'center' }}>
            <h1 style={{fontSize: '2rem', margin: 0}}>Low-Poly FPS</h1>
            <p>Click to start</p>
            <p>(W, A, S, D to move)</p>
        </div>
        {socket && (
            <Canvas shadows>
                <ambientLight intensity={0.6} />
                <directionalLight position={[10, 20, 5]} intensity={1.5} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
                <Plane args={[100, 100]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                    <meshStandardMaterial color="#555" />
                </Plane>
                <Player socket={socket} />
                {Object.values(otherPlayers).map((player: any) => (
                    <OtherPlayer key={player.id} player={player} />
                ))}
            </Canvas>
        )}
    </div>
  );
}
