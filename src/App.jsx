import React, { useState, useEffect, useRef, useCallback } from 'react'
import * as firebaseService from './firebase'

const SUITS = ['♠', '♥', '♦', '♣']
const VALUES = ['A', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

const getCardPoints = (card) => {
  if (card.value === '2' || card.value === 'JOKER') return 20
  if (card.value === 'A') return 15
  if (['10', 'J', 'Q', 'K'].includes(card.value)) return 10
  return parseInt(card.value)
}

const seededRandom = (seed) => { const x = Math.sin(seed++) * 10000; return x - Math.floor(x) }

const createDeck = (numDecks = 1, seed = Date.now()) => {
  const deck = []
  for (let d = 0; d < numDecks; d++) {
    for (const suit of SUITS) {
      for (const value of VALUES) deck.push({ id: `${suit}${value}-${d}`, suit, value, isFrime: false })
      deck.push({ id: `${suit}2-${d}`, suit, value: '2', isFrime: true })
    }
    deck.push({ id: `JOKER-R-${d}`, suit: 'R', value: 'JOKER', isFrime: true })
    deck.push({ id: `JOKER-B-${d}`, suit: 'B', value: 'JOKER', isFrime: true })
  }
  let s = seed
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(seededRandom(s++) * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]] }
  return deck
}

const getValueIndex = (value) => ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'].indexOf(value)

const isValidMeld = (cards) => {
  if (cards.length < 3) return false
  const nonFrimes = cards.filter(c => !c.isFrime)
  if (nonFrimes.length === 0) return false
  const values = nonFrimes.map(c => c.value), suits = nonFrimes.map(c => c.suit)
  if (new Set(values).size === 1) return new Set(suits).size === suits.length && cards.length <= 4
  if (new Set(suits).size === 1) {
    const indices = nonFrimes.map(c => getValueIndex(c.value)).sort((a, b) => a - b)
    return indices[indices.length - 1] - indices[0] + 1 <= cards.length && new Set(indices).size === indices.length
  }
  return false
}

const canAddToMeld = (meld, card) => isValidMeld([...meld, card])
const generateRoomCode = () => { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)]; return c }

const Card = ({ card, selected, onClick, faceDown, small, disabled, style }) => {
  const isRed = card?.suit === '♥' || card?.suit === '♦' || card?.suit === 'R', isFrime = card?.isFrime
  if (faceDown) return <div style={{ width: small ? 36 : 50, height: small ? 54 : 75, borderRadius: 4, background: 'linear-gradient(135deg, #1a1a2e, #16213e)', border: '2px solid #2d2d44', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...style }}><div style={{ width: small ? 22 : 32, height: small ? 36 : 52, background: 'repeating-linear-gradient(45deg, #2d2d44, #2d2d44 3px, #1a1a2e 3px, #1a1a2e 6px)', borderRadius: 2 }} /></div>
  return <div onClick={disabled ? undefined : onClick} style={{ width: small ? 36 : 50, height: small ? 54 : 75, borderRadius: 4, background: isFrime ? 'linear-gradient(135deg, #2d1f3d, #1a1a2e)' : '#fff', border: selected ? '3px solid #00ff88' : isFrime ? '2px solid #8b5cf6' : '2px solid #bbb', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'default' : 'pointer', transform: selected ? 'translateY(-4px)' : 'none', transition: 'all 0.1s', boxShadow: selected ? '0 4px 10px rgba(0,255,136,0.3)' : '0 2px 4px rgba(0,0,0,0.15)', position: 'relative', flexShrink: 0, ...style }}>
    {card.value === 'JOKER' ? <div style={{ fontSize: small ? 12 : 16, color: card.suit === 'R' ? '#ef4444' : '#555' }}>★</div> : <><div style={{ position: 'absolute', top: 1, left: 2, fontSize: small ? 7 : 9, fontWeight: 'bold', color: isFrime ? '#8b5cf6' : (isRed ? '#dc2626' : '#1f2937') }}>{card.value}</div><div style={{ fontSize: small ? 11 : 16, color: isFrime ? '#8b5cf6' : (isRed ? '#dc2626' : '#333') }}>{card.suit}</div></>}
    {isFrime && <div style={{ position: 'absolute', bottom: 0, fontSize: 5, color: '#8b5cf6', fontWeight: 'bold' }}>FRIME</div>}
  </div>
}

const CardChip = ({ card, onClick, canClick }) => {
  const isRed = card.suit === '♥' || card.suit === '♦' || card.suit === 'R', isFrime = card.isFrime
  return <div onClick={canClick ? onClick : undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 1, padding: '2px 4px', background: isFrime ? 'rgba(139,92,246,0.4)' : '#fff', borderRadius: 3, cursor: canClick ? 'pointer' : 'default', border: canClick ? '1px solid #00ff88' : '1px solid #ddd', fontSize: 10, fontWeight: 'bold', color: isFrime ? '#c4b5fd' : (isRed ? '#dc2626' : '#1f2937') }}>{card.value === 'JOKER' ? '★' : card.value}{card.value !== 'JOKER' && <span style={{ fontSize: 9 }}>{card.suit}</span>}</div>
}

export default function App() {
  const [gamePhase, setGamePhase] = useState('menu')
  const [gameMode, setGameMode] = useState('solo')
  const [roomCode, setRoomCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [numPlayers, setNumPlayers] = useState(2)
  const [players, setPlayers] = useState([])
  const [currentPlayer, setCurrentPlayer] = useState(0)
  const [deck, setDeck] = useState([])
  const [discard, setDiscard] = useState([])
  const [melds, setMelds] = useState([])
  const [selectedCards, setSelectedCards] = useState([])
  const [turnPhase, setTurnPhase] = useState('draw')
  const [message, setMessage] = useState('')
  const [scores, setScores] = useState([])
  const [roundNumber, setRoundNumber] = useState(1)
  const [sortMode, setSortMode] = useState('none')
  const [actionLog, setActionLog] = useState([])
  const [joinCode, setJoinCode] = useState('')
  const [isHost, setIsHost] = useState(false)
  const [firebaseAvailable, setFirebaseAvailable] = useState(false)

  const stateRef = useRef({})
  const unsubscribeRef = useRef(null)

  useEffect(() => { stateRef.current = { players, deck, discard, melds, scores, currentPlayer, turnPhase, gamePhase, actionLog, message, roundNumber } }, [players, deck, discard, melds, scores, currentPlayer, turnPhase, gamePhase, actionLog, message, roundNumber])

  useEffect(() => {
    let id = localStorage.getItem('lechartrand_player_id')
    if (!id) { id = 'player_' + Math.random().toString(36).substr(2, 9); localStorage.setItem('lechartrand_player_id', id) }
    setPlayerId(id)
    const savedName = localStorage.getItem('lechartrand_player_name')
    if (savedName) setPlayerName(savedName)
    setFirebaseAvailable(firebaseService.isFirebaseAvailable())
    const params = new URLSearchParams(window.location.search)
    const room = params.get('room')
    if (room && room.length === 6) setJoinCode(room.toUpperCase())
  }, [])

  useEffect(() => { return () => { if (unsubscribeRef.current) unsubscribeRef.current(); if (roomCode && playerId) firebaseService.leaveRoom(roomCode, playerId) } }, [roomCode, playerId])

  const subscribeToRoom = useCallback((code) => {
    if (unsubscribeRef.current) unsubscribeRef.current()
    unsubscribeRef.current = firebaseService.subscribeToRoom(code, (roomData) => {
      if (!roomData) { setMessage('Salon introuvable'); return }
      if (roomData.players) { const playerList = Object.values(roomData.players).filter(p => p.online !== false).sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0)); if (roomData.status === 'lobby') setPlayers(playerList) }
      if (roomData.gameState) { const gs = roomData.gameState; if (gs.players) setPlayers(gs.players); if (gs.deck) setDeck(gs.deck); if (gs.discard) setDiscard(gs.discard); if (gs.melds) setMelds(gs.melds); if (gs.scores) setScores(gs.scores); if (typeof gs.currentPlayer === 'number') setCurrentPlayer(gs.currentPlayer); if (gs.turnPhase) setTurnPhase(gs.turnPhase); if (gs.gamePhase) setGamePhase(gs.gamePhase); if (gs.actionLog) setActionLog(gs.actionLog); if (gs.message) setMessage(gs.message); if (gs.roundNumber) setRoundNumber(gs.roundNumber) }
      if (roomData.status === 'playing' && stateRef.current.gamePhase === 'lobby') setGamePhase('playing')
    })
  }, [])

  const syncToFirebase = useCallback(async (newState) => { if (gameMode !== 'online' || !roomCode) return; await firebaseService.updateGameState(roomCode, { ...stateRef.current, ...newState }) }, [gameMode, roomCode])

  const createRoom = async () => { const code = generateRoomCode(); const hostPlayer = { id: playerId, name: playerName || 'Hôte', isHost: true }; if (await firebaseService.createRoom(code, hostPlayer)) { setRoomCode(code); setGameMode('online'); setIsHost(true); setPlayers([hostPlayer]); setScores([0]); setGamePhase('lobby'); subscribeToRoom(code) } else setMessage('Erreur création') }

  const joinRoom = async () => { if (!joinCode || joinCode.length !== 6) return; const code = joinCode.toUpperCase(); if (!await firebaseService.checkRoomExists(code)) { setMessage('Salon introuvable'); return }; const player = { id: playerId, name: playerName || 'Joueur', isHost: false }; const result = await firebaseService.joinRoom(code, player); if (result.success) { setRoomCode(code); setGameMode('online'); setIsHost(false); setGamePhase('lobby'); subscribeToRoom(code) } else setMessage('Erreur: ' + result.error) }

  const startSoloGame = () => { setGameMode('solo'); const numDecks = numPlayers === 4 ? 2 : 1; const newDeck = createDeck(numDecks, Date.now()); const newPlayers = []; for (let i = 0; i < numPlayers; i++) newPlayers.push({ id: i === 0 ? playerId : `ai_${i}`, name: i === 0 ? (playerName || 'Toi') : `Ordi ${i}`, hand: newDeck.splice(0, 9), isHuman: i === 0, isAI: i !== 0 }); setPlayers(newPlayers); setDeck(newDeck); setDiscard(newDeck.splice(0, 1)); setMelds([]); setCurrentPlayer(0); setTurnPhase('draw'); setSelectedCards([]); setGamePhase('playing'); setMessage('Ton tour - Pioche'); setActionLog([]); setScores(new Array(numPlayers).fill(0)) }

  const startMultiplayerGame = async () => { if (players.length < 2 || !isHost) return; const numDecks = players.length === 4 ? 2 : 1; const newDeck = createDeck(numDecks, Date.now()); const newPlayers = players.map(p => ({ ...p, hand: newDeck.splice(0, 9) })); const topCard = newDeck.splice(0, 1); const newScores = new Array(players.length).fill(0); const msg = `Tour de ${newPlayers[0].name}`; setPlayers(newPlayers); setDeck(newDeck); setDiscard(topCard); setMelds([]); setCurrentPlayer(0); setTurnPhase('draw'); setSelectedCards([]); setGamePhase('playing'); setScores(newScores); setActionLog([]); setRoundNumber(1); setMessage(msg); await firebaseService.updateRoomStatus(roomCode, 'playing'); await firebaseService.updateGameState(roomCode, { players: newPlayers, deck: newDeck, discard: topCard, melds: [], scores: newScores, currentPlayer: 0, turnPhase: 'draw', gamePhase: 'playing', actionLog: [], message: msg, roundNumber: 1 }) }

  const myPlayerIndex = players.findIndex(p => p.id === playerId)
  const isMyTurn = currentPlayer === myPlayerIndex

  const drawFromDeck = async () => { if (turnPhase !== 'draw' || !isMyTurn) return; const newDeck = [...deck]; const card = newDeck.pop(); const newPlayers = [...players]; newPlayers[myPlayerIndex] = { ...newPlayers[myPlayerIndex], hand: [...newPlayers[myPlayerIndex].hand, card] }; const newLog = [...actionLog, { player: players[myPlayerIndex].name, action: 'pioche', icon: '📥' }]; setDeck(newDeck); setPlayers(newPlayers); setTurnPhase('play'); setActionLog(newLog); setMessage('Pose ou défausse'); if (gameMode === 'online') await syncToFirebase({ deck: newDeck, players: newPlayers, turnPhase: 'play', actionLog: newLog, message: 'Pose ou défausse' }) }

  const drawFromDiscard = async (idx) => { if (turnPhase !== 'draw' || !isMyTurn) return; const cardsToTake = discard.slice(idx); const remaining = discard.slice(0, idx); const newPlayers = [...players]; newPlayers[myPlayerIndex] = { ...newPlayers[myPlayerIndex], hand: [...newPlayers[myPlayerIndex].hand, ...cardsToTake] }; const newLog = [...actionLog, { player: players[myPlayerIndex].name, action: cardsToTake.length > 1 ? `+${cardsToTake.length}` : cardsToTake[0].value + cardsToTake[0].suit, icon: '📤' }]; setDiscard(remaining); setPlayers(newPlayers); setTurnPhase('play'); setActionLog(newLog); setMessage('Pose ou défausse'); if (gameMode === 'online') await syncToFirebase({ discard: remaining, players: newPlayers, turnPhase: 'play', actionLog: newLog }) }

  const toggleCard = (card) => { if (!isMyTurn || turnPhase !== 'play') return; setSelectedCards(prev => prev.some(c => c.id === card.id) ? prev.filter(c => c.id !== card.id) : [...prev, card]) }

  const createMeld = async () => { if (selectedCards.length < 3 || !isValidMeld(selectedCards)) { setMessage('Invalide!'); return }; const newMelds = [...melds, { owner: myPlayerIndex, cards: [...selectedCards] }]; const newPlayers = [...players]; newPlayers[myPlayerIndex] = { ...newPlayers[myPlayerIndex], hand: newPlayers[myPlayerIndex].hand.filter(c => !selectedCards.some(s => s.id === c.id)) }; const newLog = [...actionLog, { player: players[myPlayerIndex].name, action: 'pose', icon: '🃏' }]; setMelds(newMelds); setPlayers(newPlayers); setSelectedCards([]); setActionLog(newLog); if (newPlayers[myPlayerIndex].hand.length === 0) await endRound(newPlayers, newMelds, newLog); else if (gameMode === 'online') await syncToFirebase({ melds: newMelds, players: newPlayers, actionLog: newLog }) }

  const addToMeld = async (meldIdx) => { if (selectedCards.length !== 1) return; const card = selectedCards[0]; const meld = melds[meldIdx]; if (!canAddToMeld(meld.cards, card)) return; const newMelds = [...melds]; newMelds[meldIdx] = { ...meld, cards: [...meld.cards, card] }; const newPlayers = [...players]; newPlayers[myPlayerIndex] = { ...newPlayers[myPlayerIndex], hand: newPlayers[myPlayerIndex].hand.filter(c => c.id !== card.id) }; const newLog = [...actionLog, { player: players[myPlayerIndex].name, action: '+' + card.value, icon: '➕' }]; setMelds(newMelds); setPlayers(newPlayers); setSelectedCards([]); setActionLog(newLog); if (newPlayers[myPlayerIndex].hand.length === 0) await endRound(newPlayers, newMelds, newLog); else if (gameMode === 'online') await syncToFirebase({ melds: newMelds, players: newPlayers, actionLog: newLog }) }

  const discardCard = async () => { if (selectedCards.length !== 1) return; const card = selectedCards[0]; const newPlayers = [...players]; newPlayers[myPlayerIndex] = { ...newPlayers[myPlayerIndex], hand: newPlayers[myPlayerIndex].hand.filter(c => c.id !== card.id) }; const newDiscard = [...discard, card]; const newLog = [...actionLog, { player: players[myPlayerIndex].name, action: card.value + card.suit, icon: '🗑️' }]; setPlayers(newPlayers); setDiscard(newDiscard); setSelectedCards([]); setActionLog(newLog); if (newPlayers[myPlayerIndex].hand.length === 0) await endRound(newPlayers, melds, newLog); else { const next = (currentPlayer + 1) % players.length; const msg = `Tour de ${newPlayers[next].name}`; setCurrentPlayer(next); setTurnPhase('draw'); setMessage(msg); if (gameMode === 'online') await syncToFirebase({ players: newPlayers, discard: newDiscard, currentPlayer: next, turnPhase: 'draw', actionLog: newLog, message: msg }) } }

  const endRound = async (finalPlayers, finalMelds, newLog) => { const newScores = [...scores]; finalPlayers.forEach((p, i) => { const mPts = finalMelds.filter(m => m.owner === i).reduce((s, m) => s + m.cards.reduce((ss, c) => ss + getCardPoints(c), 0), 0); newScores[i] += mPts - p.hand.reduce((s, c) => s + getCardPoints(c), 0) }); setScores(newScores); const newPhase = newScores.some(s => s >= 500) ? 'gameEnd' : 'roundEnd'; setGamePhase(newPhase); if (gameMode === 'online') await syncToFirebase({ scores: newScores, gamePhase: newPhase, actionLog: newLog }) }

  useEffect(() => {
    if (gamePhase !== 'playing' || gameMode !== 'solo' || !players[currentPlayer]?.isAI) return
    const timer = setTimeout(() => {
      const st = stateRef.current; let newPlayers = JSON.parse(JSON.stringify(st.players)); let newDeck = [...st.deck]; let newDiscard = [...st.discard]; let newMelds = JSON.parse(JSON.stringify(st.melds)); const logs = []; const pName = newPlayers[currentPlayer].name
      if (newDeck.length > 0) { newPlayers[currentPlayer].hand.push(newDeck.pop()); logs.push({ player: pName, action: 'pioche', icon: '📥' }) }
      let found = true, iter = 0; while (found && iter < 5) { found = false; iter++; const hand = newPlayers[currentPlayer].hand; for (let i = 0; i < hand.length && !found; i++) for (let j = i + 1; j < hand.length && !found; j++) for (let k = j + 1; k < hand.length && !found; k++) { const tryM = [hand[i], hand[j], hand[k]]; if (isValidMeld(tryM)) { newMelds.push({ owner: currentPlayer, cards: tryM }); newPlayers[currentPlayer].hand = hand.filter(c => !tryM.some(m => m.id === c.id)); logs.push({ player: pName, action: 'pose', icon: '🃏' }); found = true } } }
      if (newPlayers[currentPlayer].hand.length > 0) { const sorted = [...newPlayers[currentPlayer].hand].sort((a, b) => getCardPoints(b) - getCardPoints(a)); const disc = sorted[0]; newPlayers[currentPlayer].hand = newPlayers[currentPlayer].hand.filter(c => c.id !== disc.id); newDiscard.push(disc); logs.push({ player: pName, action: disc.value + disc.suit, icon: '🗑️' }) }
      setPlayers(newPlayers); setDeck(newDeck); setDiscard(newDiscard); setMelds(newMelds); setActionLog(prev => [...prev, ...logs])
      if (newPlayers[currentPlayer].hand.length === 0) { const newScores = [...st.scores]; newPlayers.forEach((p, i) => { const mPts = newMelds.filter(m => m.owner === i).reduce((s, m) => s + m.cards.reduce((ss, c) => ss + getCardPoints(c), 0), 0); newScores[i] += mPts - p.hand.reduce((s, c) => s + getCardPoints(c), 0) }); setScores(newScores); setGamePhase(newScores.some(s => s >= 500) ? 'gameEnd' : 'roundEnd') }
      else { const next = (currentPlayer + 1) % numPlayers; setCurrentPlayer(next); setTurnPhase('draw'); setMessage(next === 0 ? 'Ton tour - Pioche' : `Tour de ${newPlayers[next].name}...`) }
    }, 800)
    return () => clearTimeout(timer)
  }, [currentPlayer, gamePhase, gameMode, numPlayers])

  const sortedHand = () => { const myPlayer = players[myPlayerIndex]; if (!myPlayer) return []; const hand = [...myPlayer.hand]; if (sortMode === 'value') { const order = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'JOKER']; hand.sort((a, b) => order.indexOf(a.value) - order.indexOf(b.value)) } else if (sortMode === 'suit') { const suitOrder = ['♠', '♥', '♦', '♣', 'R', 'B']; const valOrder = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'JOKER']; hand.sort((a, b) => { const sd = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit); return sd !== 0 ? sd : valOrder.indexOf(a.value) - valOrder.indexOf(b.value) }) }; return hand }

  const copyRoomLink = () => { navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?room=${roomCode}`); setMessage('Lien copié!'); setTimeout(() => setMessage(''), 2000) }

  // MENU
  if (gamePhase === 'menu') return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a0f, #1a1a2e)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk, system-ui', color: '#fff', padding: 16 }}>
      <h1 style={{ fontSize: 42, background: 'linear-gradient(135deg, #00ff88, #00d4ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 2 }}>LE CHARTRAND</h1>
      <p style={{ color: '#888', marginBottom: 20, fontSize: 13 }}>Rami 500</p>
      <div style={{ marginBottom: 20 }}><input type="text" placeholder="Ton nom..." value={playerName} onChange={(e) => { setPlayerName(e.target.value); localStorage.setItem('lechartrand_player_name', e.target.value) }} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, width: 180, textAlign: 'center' }} /></div>
      <div style={{ display: 'flex', gap: 12, flexDirection: 'column', width: 260 }}>
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 16, border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 10 }}>🎮 Solo vs IA</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, justifyContent: 'center' }}>{[2, 3, 4].map(n => <button key={n} onClick={() => setNumPlayers(n)} style={{ width: 40, height: 40, borderRadius: 6, border: 'none', background: numPlayers === n ? 'linear-gradient(135deg, #00ff88, #00d4ff)' : 'rgba(255,255,255,0.1)', color: numPlayers === n ? '#000' : '#fff', fontSize: 15, fontWeight: 'bold', cursor: 'pointer' }}>{n}</button>)}</div>
          <button onClick={startSoloGame} style={{ width: '100%', padding: '8px', borderRadius: 6, border: 'none', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff', fontSize: 13, fontWeight: 'bold', cursor: 'pointer' }}>Jouer</button>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 16, border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>👥 Multi <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: firebaseAvailable ? 'rgba(0,255,136,0.2)' : 'rgba(255,87,87,0.2)', color: firebaseAvailable ? '#00ff88' : '#ff5757' }}>{firebaseAvailable ? '● Online' : '○ Config'}</span></div>
          {firebaseAvailable ? <><button onClick={createRoom} style={{ width: '100%', padding: '8px', borderRadius: 6, border: 'none', background: 'linear-gradient(135deg, #00ff88, #00d4ff)', color: '#000', fontSize: 13, fontWeight: 'bold', cursor: 'pointer', marginBottom: 8 }}>Créer</button><div style={{ display: 'flex', gap: 6 }}><input type="text" placeholder="CODE" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))} style={{ flex: 1, padding: '6px 10px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, textAlign: 'center', letterSpacing: 2 }} /><button onClick={joinRoom} disabled={joinCode.length !== 6} style={{ padding: '6px 14px', borderRadius: 5, border: 'none', background: joinCode.length === 6 ? '#00ff88' : 'rgba(255,255,255,0.1)', color: joinCode.length === 6 ? '#000' : '#666', fontWeight: 'bold', fontSize: 12, cursor: joinCode.length === 6 ? 'pointer' : 'not-allowed' }}>OK</button></div></> : <div style={{ fontSize: 11, color: '#888', textAlign: 'center' }}>Config Firebase dans<br/><code style={{ color: '#8b5cf6' }}>src/firebaseConfig.js</code></div>}
        </div>
      </div>
      {message && <div style={{ marginTop: 15, color: '#ff5757', fontSize: 12 }}>{message}</div>}
      <p style={{ marginTop: 25, fontSize: 10, color: '#555' }}>v1.0 • Massive Medias</p>
    </div>
  )

  // LOBBY
  if (gamePhase === 'lobby') return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a0f, #1a1a2e)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk, system-ui', color: '#fff', padding: 16 }}>
      <h2 style={{ fontSize: 22, marginBottom: 6 }}>Salon</h2>
      <div style={{ background: 'rgba(139,92,246,0.2)', padding: '10px 20px', borderRadius: 6, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 22, fontWeight: 'bold', letterSpacing: 3, color: '#00ff88' }}>{roomCode}</span><button onClick={copyRoomLink} style={{ padding: '4px 10px', borderRadius: 5, border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 10, cursor: 'pointer' }}>📋</button></div>
      {message && <div style={{ color: '#00ff88', marginBottom: 8, fontSize: 11 }}>{message}</div>}
      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 16, marginBottom: 16, minWidth: 220 }}><div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>Joueurs ({players.length}/4)</div>{players.map((p, i) => <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}><span style={{ fontSize: 16 }}>{p.isHost ? '👑' : '👤'}</span><span style={{ color: p.id === playerId ? '#00ff88' : '#fff', fontSize: 13 }}>{p.name}</span>{p.id === playerId && <span style={{ fontSize: 9, color: '#888' }}>(toi)</span>}</div>)}{players.length < 4 && <div style={{ padding: '6px 0', color: '#555', fontSize: 12 }}>En attente...</div>}</div>
      <div style={{ display: 'flex', gap: 8 }}><button onClick={() => { setGamePhase('menu'); setRoomCode(''); firebaseService.leaveRoom(roomCode, playerId) }} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#888', fontSize: 12, cursor: 'pointer' }}>Quitter</button>{isHost && <button onClick={startMultiplayerGame} disabled={players.length < 2} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: players.length >= 2 ? 'linear-gradient(135deg, #00ff88, #00d4ff)' : 'rgba(255,255,255,0.1)', color: players.length >= 2 ? '#000' : '#666', fontWeight: 'bold', fontSize: 12, cursor: players.length >= 2 ? 'pointer' : 'not-allowed' }}>Commencer</button>}</div>
    </div>
  )

  // END
  if (gamePhase === 'roundEnd' || gamePhase === 'gameEnd') { const winner = scores.indexOf(Math.max(...scores)); return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a0f, #1a1a2e)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk, system-ui', color: '#fff', padding: 16 }}>
      <h2 style={{ fontSize: 24, marginBottom: 14, color: gamePhase === 'gameEnd' ? '#00ff88' : '#fff' }}>{gamePhase === 'gameEnd' ? '🏆 Terminée!' : `Fin manche ${roundNumber}`}</h2>
      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 14, marginBottom: 14, minWidth: 200 }}>{players.map((p, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', color: i === winner ? '#00ff88' : '#fff', fontSize: 13 }}><span>{p.name} {i === winner && '👑'}</span><span>{scores[i]} pts</span></div>)}</div>
      <button onClick={async () => { if (gamePhase === 'gameEnd') { if (gameMode === 'online' && roomCode) await firebaseService.deleteRoom(roomCode); setScores([]); setRoundNumber(1); setGamePhase('menu'); setRoomCode('') } else { setRoundNumber(r => r + 1); if (gameMode === 'solo') startSoloGame(); else if (isHost) startMultiplayerGame() } }} style={{ padding: '8px 22px', borderRadius: 6, border: 'none', background: gamePhase === 'gameEnd' ? 'linear-gradient(135deg, #00ff88, #00d4ff)' : 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: gamePhase === 'gameEnd' ? '#000' : '#fff', fontSize: 13, fontWeight: 'bold', cursor: 'pointer' }}>{gamePhase === 'gameEnd' ? 'Menu' : (isHost || gameMode === 'solo' ? 'Suivante' : 'Attente...')}</button>
    </div>
  )}

  // GAME
  const myMelds = melds.filter(m => m.owner === myPlayerIndex), canClickDiscard = isMyTurn && turnPhase === 'draw', otherPlayers = players.filter((_, i) => i !== myPlayerIndex)
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a0f, #1a1a2e)', fontFamily: 'Space Grotesk, system-ui', color: '#fff', padding: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 4 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><h1 style={{ fontSize: 14, background: 'linear-gradient(135deg, #00ff88, #00d4ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>LE CHARTRAND</h1>{roomCode && <span style={{ fontSize: 9, color: '#888', background: 'rgba(139,92,246,0.2)', padding: '1px 6px', borderRadius: 3 }}>{roomCode}</span>}</div><div style={{ display: 'flex', gap: 6 }}>{players.map((p, i) => <div key={i} style={{ padding: '2px 6px', background: currentPlayer === i ? 'rgba(0,255,136,0.2)' : 'rgba(255,255,255,0.05)', borderRadius: 3, border: currentPlayer === i ? '1px solid #00ff88' : '1px solid transparent' }}><div style={{ fontSize: 8, color: '#888' }}>{p.name}</div><div style={{ fontSize: 11 }}>{scores[i]}p</div></div>)}</div></div>
      <div style={{ textAlign: 'center', padding: '5px 10px', background: isMyTurn ? 'rgba(0,255,136,0.2)' : 'rgba(139,92,246,0.2)', borderRadius: 4, marginBottom: 6, border: isMyTurn ? '1px solid rgba(0,255,136,0.3)' : '1px solid rgba(139,92,246,0.3)', fontSize: 11 }}>{message}</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <div style={{ width: 110, flexShrink: 0, background: 'rgba(0,0,0,0.3)', borderRadius: 5, padding: 5, maxHeight: 220, overflowY: 'auto' }}><div style={{ fontSize: 8, color: '#888', marginBottom: 3, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 2 }}>📋 Actions</div>{actionLog.slice(-8).map((log, i) => <div key={i} style={{ fontSize: 7, color: log.player === players[myPlayerIndex]?.name ? '#00ff88' : '#ccc', padding: '1px 2px', background: log.player === players[myPlayerIndex]?.name ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.03)', borderRadius: 2, marginBottom: 1 }}>{log.icon} <b>{log.player}</b>: {log.action}</div>)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', justifyContent: 'center' }}>{otherPlayers.map((p) => { const pIdx = players.indexOf(p); const pMelds = melds.filter(m => m.owner === pIdx); return <div key={p.id} style={{ background: currentPlayer === pIdx ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.03)', borderRadius: 5, padding: 6, border: currentPlayer === pIdx ? '1px solid rgba(0,255,136,0.3)' : '1px solid rgba(255,255,255,0.1)', minWidth: 90 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}><span style={{ fontSize: 10, fontWeight: 'bold', color: currentPlayer === pIdx ? '#00ff88' : '#fff' }}>{p.name}</span><span style={{ fontSize: 8, color: '#888' }}>{p.hand?.length || 0}</span></div><div style={{ display: 'flex' }}>{(p.hand || []).slice(0, 4).map((_, i) => <Card key={i} faceDown small style={{ marginLeft: i > 0 ? -14 : 0 }} />)}{(p.hand?.length || 0) > 4 && <div style={{ marginLeft: -10, background: '#2d2d44', borderRadius: 2, padding: '0 3px', fontSize: 6, color: '#888', display: 'flex', alignItems: 'center' }}>+{p.hand.length - 4}</div>}</div>{pMelds.length > 0 && <div style={{ marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 3 }}>{pMelds.map((m, mi) => <div key={mi} style={{ display: 'flex', marginBottom: 1, cursor: selectedCards.length === 1 && canAddToMeld(m.cards, selectedCards[0]) ? 'pointer' : 'default', border: selectedCards.length === 1 && canAddToMeld(m.cards, selectedCards[0]) ? '1px dashed #00ff88' : 'none', borderRadius: 2, padding: 1 }} onClick={() => selectedCards.length === 1 && canAddToMeld(m.cards, selectedCards[0]) && addToMeld(melds.indexOf(m))}>{m.cards.map((c, ci) => <Card key={c.id} card={c} small style={{ marginLeft: ci > 0 ? -10 : 0 }} disabled />)}</div>)}</div>}</div> })}</div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 8, alignItems: 'flex-start', justifyContent: 'center' }}><div onClick={canClickDiscard ? drawFromDeck : undefined} style={{ textAlign: 'center', cursor: canClickDiscard ? 'pointer' : 'default' }}><div style={{ fontSize: 8, color: '#888', marginBottom: 2 }}>Pioche</div><Card faceDown /><div style={{ fontSize: 7, color: '#666', marginTop: 1 }}>{deck.length}</div></div><div style={{ flex: 1, maxWidth: 320 }}><div style={{ fontSize: 8, color: '#888', marginBottom: 2 }}>Défausse ({discard.length})</div><div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', background: 'rgba(139,92,246,0.15)', borderRadius: 4, padding: 4, minHeight: 20 }}>{discard.length === 0 ? <span style={{ color: '#666', fontSize: 9 }}>Vide</span> : discard.map((c, i) => <CardChip key={c.id} card={c} canClick={canClickDiscard} onClick={() => drawFromDiscard(i)} />)}</div>{canClickDiscard && discard.length > 0 && <div style={{ fontSize: 6, color: '#888', marginTop: 1, textAlign: 'center' }}>Clique = prendre + droite</div>}</div></div>
        </div>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: 8, border: isMyTurn ? '2px solid rgba(0,255,136,0.3)' : '1px solid rgba(255,255,255,0.1)' }}>
        {myMelds.length > 0 && <div style={{ marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.1)' }}><div style={{ fontSize: 8, color: '#888', marginBottom: 3 }}>Tes combinaisons:</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{myMelds.map((m, mi) => <div key={mi} style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,255,136,0.1)', borderRadius: 3, padding: 2, border: selectedCards.length === 1 && canAddToMeld(m.cards, selectedCards[0]) ? '2px dashed #00ff88' : '1px solid rgba(0,255,136,0.3)', cursor: selectedCards.length === 1 && canAddToMeld(m.cards, selectedCards[0]) ? 'pointer' : 'default' }} onClick={() => selectedCards.length === 1 && canAddToMeld(m.cards, selectedCards[0]) && addToMeld(melds.indexOf(m))}>{m.cards.map((c, ci) => <Card key={c.id} card={c} small style={{ marginLeft: ci > 0 ? -8 : 0 }} disabled />)}<div style={{ marginLeft: 3, fontSize: 7, color: '#00ff88' }}>{m.cards.reduce((s, c) => s + getCardPoints(c), 0)}p</div></div>)}</div></div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, flexWrap: 'wrap', gap: 3 }}><span style={{ color: '#888', fontSize: 10 }}>Ta main ({players[myPlayerIndex]?.hand?.length || 0})</span><div style={{ display: 'flex', gap: 2 }}>{['none', 'value', 'suit'].map(mode => <button key={mode} onClick={() => setSortMode(mode)} style={{ padding: '1px 4px', borderRadius: 2, border: 'none', background: sortMode === mode ? 'rgba(0,255,136,0.3)' : 'rgba(255,255,255,0.1)', color: sortMode === mode ? '#00ff88' : '#888', fontSize: 7, cursor: 'pointer' }}>{mode === 'none' ? '—' : mode === 'value' ? 'Val' : 'Coul'}</button>)}</div>{selectedCards.length > 0 && <span style={{ color: '#00ff88', fontSize: 9 }}>{selectedCards.length} sel.</span>}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center', marginBottom: 6 }}>{sortedHand().map(card => <Card key={card.id} card={card} selected={selectedCards.some(c => c.id === card.id)} onClick={() => toggleCard(card)} disabled={!isMyTurn || turnPhase !== 'play'} />)}</div>
        {isMyTurn && turnPhase === 'play' && <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}><button onClick={createMeld} disabled={selectedCards.length < 3} style={{ padding: '5px 12px', borderRadius: 3, border: 'none', background: selectedCards.length >= 3 ? 'linear-gradient(135deg, #00ff88, #00d4ff)' : 'rgba(255,255,255,0.1)', color: selectedCards.length >= 3 ? '#000' : '#666', fontWeight: 'bold', fontSize: 10, cursor: selectedCards.length >= 3 ? 'pointer' : 'not-allowed' }}>Poser</button><button onClick={discardCard} disabled={selectedCards.length !== 1} style={{ padding: '5px 12px', borderRadius: 3, border: 'none', background: selectedCards.length === 1 ? 'linear-gradient(135deg, #ff4757, #ff6b81)' : 'rgba(255,255,255,0.1)', color: selectedCards.length === 1 ? '#fff' : '#666', fontWeight: 'bold', fontSize: 10, cursor: selectedCards.length === 1 ? 'pointer' : 'not-allowed' }}>Défausser</button><button onClick={() => setSelectedCards([])} style={{ padding: '5px 12px', borderRadius: 3, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#888', fontSize: 10, cursor: 'pointer' }}>✕</button></div>}
      </div>
    </div>
  )
}
