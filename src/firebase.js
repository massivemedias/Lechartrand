import { initializeApp } from 'firebase/app';
import { 
  getDatabase, 
  ref, 
  set, 
  onValue, 
  push, 
  update, 
  remove,
  onDisconnect,
  serverTimestamp 
} from 'firebase/database';
import firebaseConfig from './firebaseConfig';

// Initialize Firebase
let app;
let db;

try {
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);
} catch (error) {
  console.warn('Firebase initialization failed:', error);
}

// Room reference helper
const getRoomRef = (roomCode) => ref(db, `rooms/${roomCode}`);
const getPlayersRef = (roomCode) => ref(db, `rooms/${roomCode}/players`);
const getGameStateRef = (roomCode) => ref(db, `rooms/${roomCode}/gameState`);

// Create a new room
export const createRoom = async (roomCode, hostPlayer) => {
  if (!db) return false;
  
  try {
    await set(getRoomRef(roomCode), {
      createdAt: serverTimestamp(),
      host: hostPlayer.id,
      status: 'lobby',
      players: {
        [hostPlayer.id]: {
          ...hostPlayer,
          joinedAt: serverTimestamp(),
          online: true
        }
      },
      gameState: null
    });
    
    // Set up disconnect cleanup for host
    const playerRef = ref(db, `rooms/${roomCode}/players/${hostPlayer.id}/online`);
    onDisconnect(playerRef).set(false);
    
    return true;
  } catch (error) {
    console.error('Error creating room:', error);
    return false;
  }
};

// Join an existing room
export const joinRoom = async (roomCode, player) => {
  if (!db) return { success: false, error: 'Firebase not initialized' };
  
  try {
    const playerRef = ref(db, `rooms/${roomCode}/players/${player.id}`);
    await set(playerRef, {
      ...player,
      joinedAt: serverTimestamp(),
      online: true
    });
    
    // Set up disconnect cleanup
    const onlineRef = ref(db, `rooms/${roomCode}/players/${player.id}/online`);
    onDisconnect(onlineRef).set(false);
    
    return { success: true };
  } catch (error) {
    console.error('Error joining room:', error);
    return { success: false, error: error.message };
  }
};

// Leave room
export const leaveRoom = async (roomCode, playerId) => {
  if (!db) return;
  
  try {
    const playerRef = ref(db, `rooms/${roomCode}/players/${playerId}`);
    await remove(playerRef);
  } catch (error) {
    console.error('Error leaving room:', error);
  }
};

// Update game state
export const updateGameState = async (roomCode, gameState) => {
  if (!db) return false;
  
  try {
    await set(getGameStateRef(roomCode), {
      ...gameState,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error updating game state:', error);
    return false;
  }
};

// Update room status
export const updateRoomStatus = async (roomCode, status) => {
  if (!db) return false;
  
  try {
    await update(getRoomRef(roomCode), { status });
    return true;
  } catch (error) {
    console.error('Error updating room status:', error);
    return false;
  }
};

// Subscribe to room changes
export const subscribeToRoom = (roomCode, callback) => {
  if (!db) {
    callback(null);
    return () => {};
  }
  
  const roomRef = getRoomRef(roomCode);
  const unsubscribe = onValue(roomRef, (snapshot) => {
    const data = snapshot.val();
    callback(data);
  }, (error) => {
    console.error('Error subscribing to room:', error);
    callback(null);
  });
  
  return unsubscribe;
};

// Subscribe to players only
export const subscribeToPlayers = (roomCode, callback) => {
  if (!db) {
    callback({});
    return () => {};
  }
  
  const playersRef = getPlayersRef(roomCode);
  const unsubscribe = onValue(playersRef, (snapshot) => {
    const data = snapshot.val() || {};
    callback(data);
  });
  
  return unsubscribe;
};

// Subscribe to game state only
export const subscribeToGameState = (roomCode, callback) => {
  if (!db) {
    callback(null);
    return () => {};
  }
  
  const gameStateRef = getGameStateRef(roomCode);
  const unsubscribe = onValue(gameStateRef, (snapshot) => {
    const data = snapshot.val();
    callback(data);
  });
  
  return unsubscribe;
};

// Check if room exists
export const checkRoomExists = async (roomCode) => {
  if (!db) return false;
  
  return new Promise((resolve) => {
    const roomRef = getRoomRef(roomCode);
    onValue(roomRef, (snapshot) => {
      resolve(snapshot.exists());
    }, { onlyOnce: true });
  });
};

// Delete room (cleanup)
export const deleteRoom = async (roomCode) => {
  if (!db) return;
  
  try {
    await remove(getRoomRef(roomCode));
  } catch (error) {
    console.error('Error deleting room:', error);
  }
};

// Update player online status
export const setPlayerOnline = async (roomCode, playerId, online = true) => {
  if (!db) return;
  
  try {
    const onlineRef = ref(db, `rooms/${roomCode}/players/${playerId}/online`);
    await set(onlineRef, online);
  } catch (error) {
    console.error('Error updating online status:', error);
  }
};

// Check if Firebase is available
export const isFirebaseAvailable = () => {
  return !!db;
};

export { db };
