"use client";

import { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PointerLockControls, Box, Sphere, Cylinder } from '@react-three/drei';
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

// Define bounding boxes for obstacles
const obstacles = [
  // Obstacle 1: A low, wide wall
  { position: [-10, 2.5, -10], size: [10, 5, 2] },
  // Obstacle 2: A tall, thin pillar
  { position: [15, 2.5, 5], size: [2, 5, 15] },
  // Obstacle 3: A long, high wall
  { position: [0, 4, -20], size: [20, 8, 2] },
  // Corner wall 1
  { position: [-15, 2.5, 15], size: [8, 5, 2] },
  // Corner wall 2
  { position: [15, 2.5, -15], size: [2, 5, 8] },
  // Center pillar
  { position: [0, 3, 0], size: [3, 6, 3] },
  // Elevated platform 1
  { position: [-20, 6, -20], size: [8, 1, 8] },
  // Elevated platform 2
  { position: [20, 6, 20], size: [8, 1, 8] },
  // Bridge connecting platforms
  { position: [0, 6, 0], size: [40, 1, 2] },
  // Small cube obstacles
  { position: [-5, 1, 5], size: [2, 2, 2] },
  { position: [5, 1, -5], size: [2, 2, 2] },
  // Tall tower
  { position: [-25, 7.5, 25], size: [4, 15, 4] },
  // Cylindrical columns
  { position: [-30, 5, -30], size: [2, 10, 2] }, // Better approximation of cylinder
  { position: [30, 5, 30], size: [2, 10, 2] }, // Better approximation of cylinder
  // Spherical obstacles
  { position: [-20, 1, 20], size: [4, 4, 4] }, // Better approximation of sphere
  { position: [20, 1, -20], size: [4, 4, 4] }, // Better approximation of sphere
  // Pyramid structures
  { position: [-35, 2.5, 0], size: [6, 5, 6] }, // Better approximation of cone
  { position: [35, 2.5, 0], size: [6, 5, 6] }, // Better approximation of cone
  // Barrier walls
  { position: [0, 2, 35], size: [40, 4, 1] },
  { position: [0, 2, -35], size: [40, 4, 1] },
  // Corner structures
  { position: [-35, 3, 35], size: [5, 6, 5] },
  { position: [-35, 3, -35], size: [5, 6, 5] },
  // Center piece - large cylindrical structure
  { position: [0, 0, 0], size: [10, 1, 10] } // Better approximation of cylinder
];

// Player component
function Player({ socket }: { socket: Socket }) {
  const controlsRef = useRef<any>();
  const cameraRef = useRef<any>();
  const keyMap = useKeyboard();
  const moveSpeed = 0.1;

  // Function to check collision
  const checkCollision = (newPosition: Vector3) => {
    // Player is approximately a 0.5x1.8x0.5 capsule for simplicity (width, height, depth)
    const playerSize = [0.5, 1.8, 0.5];
    
    for (const obstacle of obstacles) {
      // Check if player's new position intersects with obstacle
      const [px, py, pz] = [newPosition.x, newPosition.y, newPosition.z];
      const [ox, oy, oz] = obstacle.position;
      const [osx, osy, osz] = obstacle.size;
      const [psx, psy, psz_] = playerSize;
      
      // AABB collision detection
      if (
        Math.abs(px - ox) < (psx + osx / 2) &&
        Math.abs(py - oy) < (psy + osy / 2) &&
        Math.abs(pz - oz) < (psz_ + osz / 2)
      ) {
        return true; // Collision detected
      }
    }
    
    // Check if player is below ground level (y < 0.1 to account for small floating)
    if (newPosition.y < 0.1) {
      return true;
    }
    
    return false; // No collision
  };

  useFrame((state) => {
    if (!controlsRef.current?.isLocked) return;

    // Create movement vector based on key presses
    let moveX = 0;
    let moveZ = 0;
    
    // Forward/backward movement (using negative/positive Z values)
    if (keyMap.current['w']) moveZ -= moveSpeed;
    if (keyMap.current['s']) moveZ += moveSpeed;
    
    // Left/right movement (strafing)
    if (keyMap.current['a']) moveX -= moveSpeed;
    if (keyMap.current['d']) moveX += moveSpeed;
    
    // Create direction vector
    const direction = new Vector3(moveX, 0, moveZ);

    // Apply camera rotation to movement direction
    if (direction.length() > 0) {
        // Clone the direction vector to avoid modifying the original
        const rotatedDirection = direction.clone();
        rotatedDirection.applyEuler(new Euler(0, state.camera.rotation.y, 0, 'YXZ'));
        
        // Calculate new position
        const newPosition = state.camera.position.clone().add(rotatedDirection);
        
        // Temporarily disable collision detection to test movement
        state.camera.position.add(rotatedDirection);
    }

    // Send position to server periodically
    socket.emit('playerMove', {
      position: [state.camera.position.x, state.camera.position.y, state.camera.position.z],
      rotation: [state.camera.rotation.x, state.camera.rotation.y, state.camera.rotation.z],
    });
  });

  return <PointerLockControls ref={controlsRef} />;
}

// Component for other players
function OtherPlayer({ player }: { player: any }) {
    return (
        <Box position={player.position} castShadow>
            <meshStandardMaterial color="red" />
        </Box>
    );
}

// Map component with arena design
function Map() {
  return (
    <>
      {/* Ground plane */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      
      {/* Obstacle 1: A low, wide wall */}
      <mesh castShadow position={[-10, 2.5, -10]}>
        <boxGeometry args={[10, 5, 2]} />
        <meshStandardMaterial color="gray" />
      </mesh>
      
      {/* Obstacle 2: A tall, thin pillar */}
      <mesh castShadow position={[15, 2.5, 5]}>
        <boxGeometry args={[2, 5, 15]} />
        <meshStandardMaterial color="gray" />
      </mesh>
      
      {/* Obstacle 3: A long, high wall */}
      <mesh castShadow position={[0, 4, -20]}>
        <boxGeometry args={[20, 8, 2]} />
        <meshStandardMaterial color="dimgray" />
      </mesh>
      
      {/* Additional obstacles for more cover */}
      {/* Corner wall 1 */}
      <mesh castShadow position={[-15, 2.5, 15]}>
        <boxGeometry args={[8, 5, 2]} />
        <meshStandardMaterial color="gray" />
      </mesh>
      
      {/* Corner wall 2 */}
      <mesh castShadow position={[15, 2.5, -15]}>
        <boxGeometry args={[2, 5, 8]} />
        <meshStandardMaterial color="gray" />
      </mesh>
      
      {/* Center pillar */}
      <mesh castShadow position={[0, 3, 0]}>
        <boxGeometry args={[3, 6, 3]} />
        <meshStandardMaterial color="darkgray" />
      </mesh>
      
      {/* Elevated platform 1 */}
      <mesh position={[-20, 6, -20]} castShadow>
        <boxGeometry args={[8, 1, 8]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      
      {/* Elevated platform 2 */}
      <mesh position={[20, 6, 20]} castShadow>
        <boxGeometry args={[8, 1, 8]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      
      {/* Bridge connecting platforms */}
      <mesh position={[0, 6, 0]} castShadow>
        <boxGeometry args={[40, 1, 2]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      
      {/* Decorative elements */}
      {/* Small cube obstacles */}
      <mesh castShadow position={[-5, 1, 5]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="lightgray" />
      </mesh>
      
      <mesh castShadow position={[5, 1, -5]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="lightgray" />
      </mesh>
      
      {/* Tall tower */}
      <mesh castShadow position={[-25, 7.5, 25]}>
        <boxGeometry args={[4, 15, 4]} />
        <meshStandardMaterial color="slategray" />
      </mesh>
      
      {/* Additional decorative elements */}
      {/* Cylindrical columns */}
      <mesh castShadow position={[-30, 5, -30]}>
        <cylinderGeometry args={[1, 1, 10, 16]} />
        <meshStandardMaterial color="darkslategray" />
      </mesh>
      
      <mesh castShadow position={[30, 5, 30]}>
        <cylinderGeometry args={[1, 1, 10, 16]} />
        <meshStandardMaterial color="darkslategray" />
      </mesh>
      
      {/* Spherical obstacles */}
      <mesh castShadow position={[-20, 1, 20]}>
        <sphereGeometry args={[2, 32, 32]} />
        <meshStandardMaterial color="steelblue" />
      </mesh>
      
      <mesh castShadow position={[20, 1, -20]}>
        <sphereGeometry args={[2, 32, 32]} />
        <meshStandardMaterial color="steelblue" />
      </mesh>
      
      {/* Pyramid structures */}
      <mesh castShadow position={[-35, 2.5, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[3, 5, 4]} />
        <meshStandardMaterial color="teal" />
      </mesh>
      
      <mesh castShadow position={[35, 2.5, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[3, 5, 4]} />
        <meshStandardMaterial color="teal" />
      </mesh>
      
      {/* Barrier walls */}
      <mesh castShadow position={[0, 2, 35]} rotation={[0, 0, 0]}>
        <boxGeometry args={[40, 4, 1]} />
        <meshStandardMaterial color="maroon" />
      </mesh>
      
      <mesh castShadow position={[0, 2, -35]} rotation={[0, 0, 0]}>
        <boxGeometry args={[40, 4, 1]} />
        <meshStandardMaterial color="maroon" />
      </mesh>
      
      {/* Corner structures */}
      <mesh castShadow position={[-35, 3, 35]}>
        <boxGeometry args={[5, 6, 5]} />
        <meshStandardMaterial color="olive" />
      </mesh>
      
      <mesh castShadow position={[-35, 3, -35]}>
        <boxGeometry args={[5, 6, 5]} />
        <meshStandardMaterial color="olive" />
      </mesh>
      
      {/* Center piece - large cylindrical structure */}
      <mesh castShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[5, 5, 1, 32]} />
        <meshStandardMaterial color="indigo" />
      </mesh>
    </>
  );
}

// Main Game Component
export default function Game() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [otherPlayers, setOtherPlayers] = useState<{ [key: string]: any }>({});
  const [gameState, setGameState] = useState('loading'); // loading, ready, playing

  useEffect(() => {
    const newSocket = io("http://localhost:3001");
    setSocket(newSocket);

    newSocket.on('connect', () => setGameState('ready'));

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
        {/* Overlays */}
        {gameState !== 'playing' && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 20 }}>
              <div style={{ color: 'white', textAlign: 'center' }}>
                  {gameState === 'loading' && <h1>Connecting...</h1>}
                  {gameState === 'ready' && <div><h1>Low-Poly FPS</h1><p>Click to Play</p></div>}
              </div>
          </div>
        )}
        {socket && (
            <Canvas shadows onPointerDown={() => { if (gameState === 'ready') setGameState('playing'); }}>
                <ambientLight intensity={0.6} />
                <directionalLight position={[10, 20, 5]} intensity={1.5} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
                <Map />
                <Player socket={socket} />
                {Object.values(otherPlayers).map((player: any) => (
                    <OtherPlayer key={player.id} player={player} />
                ))}
            </Canvas>
        )}
        {/* HUD */}
        {gameState === 'playing' && (
          <>
              <div style={{ position: 'absolute', top: '50%', left: '50%', width: '4px', height: '4px', backgroundColor: 'white', borderRadius: '50%', transform: 'translate(-50%, -50%)', zIndex: 10}} />
              <div style={{ position: 'absolute', bottom: '20px', left: '20px', color: 'white', zIndex: 10, fontSize: '24px', textShadow: '2px 2px 4px #000' }}>
                  Health: 100
              </div>
               <div style={{ position: 'absolute', bottom: '20px', right: '20px', color: 'white', zIndex: 10, fontSize: '24px', textShadow: '2px 2px 4px #000' }}>
                  Weapon: None
              </div>
          </>
        )}
    </div>
  );
}
