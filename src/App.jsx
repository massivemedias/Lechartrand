import React, { useState, useEffect, useRef, useCallback } from 'react'
import * as firebaseService from './firebase'

// ============ STYLES & ANIMATIONS ============
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { height: 100%; overflow: hidden; }
    
    @keyframes cardDeal {
      0% { transform: translateY(-100vh) rotate(-180deg); opacity: 0; }
      100% { transform: translateY(0) rotate(0deg); opacity: 1; }
    }
    
    @keyframes cardDraw {
      0% { transform: scale(0.5) translateX(-50px); opacity: 0; }
      50% { transform: scale(1.1) translateX(0); }
      100% { transform: scale(1) translateX(0); opacity: 1; }
    }
    
    @keyframes cardDiscard {
      0% { transform: scale(1); }
      50% { transform: scale(0.8) translateY(-20px); }
      100% { transform: scale(0.6) translateY(-40px); opacity: 0; }
    }
    
    @keyframes cardSelect {
      0% { transform: translateY(0) scale(1); }
      50% { transform: translateY(-12px) scale(1.05); }
      100% { transform: translateY(-8px) scale(1.02); }
    }
    
    @keyframes meldSuccess {
      0% { transform: scale(1); box-shadow: 0 0 0 rgba(0,255,136,0); }
      50% { transform: scale(1.05); box-shadow: 0 0 30px rgba(0,255,136,0.6); }
      100% { transform: scale(1); box-shadow: 0 0 10px rgba(0,255,136,0.3); }
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
    
    @keyframes slideIn {
      0% { transform: translateX(100%); opacity: 0; }
      100% { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes bounceIn {
      0% { transform: scale(0); }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); }
    }
    
    @keyframes glow {
      0%, 100% { box-shadow: 0 0 5px rgba(0,255,136,0.3); }
      50% { box-shadow: 0 0 20px rgba(0,255,136,0.6); }
    }
    
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }
    
    .card-enter { animation: cardDraw 0.3s ease-out forwards; }
    .card-exit { animation: cardDiscard 0.25s ease-in forwards; }
    .card-selected { animation: cardSelect 0.2s ease-out forwards; }
    .meld-success { animation: meldSuccess 0.4s ease-out forwards; }
    .pulse { animation: pulse 1.5s infinite; }
    .glow { animation: glow 2s infinite; }
    .shake { animation: shake 0.3s ease-out; }
    .slide-in { animation: slideIn 0.3s ease-out forwards; }
    .bounce-in { animation: bounceIn 0.3s ease-out forwards; }
    
    .card-hover:hover { 
      transform: translateY(-4px) scale(1.02); 
      box-shadow: 0 8px 25px rgba(0,0,0,0.3);
    }
    
    .btn-primary:hover { transform: scale(1.02); filter: brightness(1.1); }
    .btn-primary:active { transform: scale(0.98); }
    
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
  `}</style>
)

// ============ GAME LOGIC ============
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
const generateRoomCode = () => String(Math.floor(Math.random() * 900) + 100) // 100-999

// ============ CARD COMPONENTS ============
const Card = ({ card, selected, onClick, faceDown, small, mini, disabled, style, animClass, delay = 0 }) => {
  const isRed = card?.suit === '♥' || card?.suit === '♦' || card?.suit === 'R'
  const isFrime = card?.isFrime
  
  // Bigger responsive sizes - desktop friendly
  const sizes = mini 
    ? { w: 40, h: 60, font: 14, corner: 9, frime: 6 }
    : small 
      ? { w: 65, h: 97, font: 22, corner: 12, frime: 7 }
      : { w: 85, h: 127, font: 32, corner: 14, frime: 8 }
  
  const baseStyle = {
    width: sizes.w,
    height: sizes.h,
    borderRadius: 6,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
    transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
    cursor: disabled ? 'default' : 'pointer',
    animationDelay: `${delay}ms`,
    ...style
  }

  if (faceDown) {
    return (
      <div 
        className={animClass}
        style={{ 
          ...baseStyle,
          background: 'linear-gradient(145deg, #1e1e3f, #0f0f23)',
          border: '2px solid #3d3d5c',
          boxShadow: '0 4px 15px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)'
        }}
      >
        <div style={{ 
          width: sizes.w - 12, 
          height: sizes.h - 16,
          background: 'repeating-linear-gradient(45deg, #2a2a4a, #2a2a4a 2px, #1a1a3a 2px, #1a1a3a 4px)',
          borderRadius: 3,
          border: '1px solid #3d3d5c'
        }} />
      </div>
    )
  }

  return (
    <div 
      onClick={disabled ? undefined : onClick}
      className={`${animClass || ''} ${!disabled && !selected ? 'card-hover' : ''} ${selected ? 'card-selected' : ''}`}
      style={{ 
        ...baseStyle,
        background: isFrime 
          ? 'linear-gradient(145deg, #2d1f4d, #1a1033)' 
          : 'linear-gradient(145deg, #ffffff, #f0f0f0)',
        border: selected 
          ? '3px solid #00ff88' 
          : isFrime 
            ? '2px solid #8b5cf6' 
            : '2px solid #d0d0d0',
        boxShadow: selected 
          ? '0 8px 25px rgba(0,255,136,0.4), 0 0 0 2px rgba(0,255,136,0.2)' 
          : '0 4px 12px rgba(0,0,0,0.15)',
        transform: selected ? 'translateY(-8px) scale(1.02)' : 'none',
      }}
    >
      {card.value === 'JOKER' ? (
        <div style={{ fontSize: sizes.font + 4, color: card.suit === 'R' ? '#ef4444' : '#666' }}>★</div>
      ) : (
        <>
          <div style={{ 
            position: 'absolute', 
            top: 3, 
            left: 4, 
            fontSize: sizes.corner, 
            fontWeight: 'bold', 
            color: isFrime ? '#a78bfa' : (isRed ? '#dc2626' : '#1f2937'),
            lineHeight: 1
          }}>
            {card.value}
          </div>
          <div style={{ 
            fontSize: sizes.font, 
            color: isFrime ? '#a78bfa' : (isRed ? '#dc2626' : '#333'),
            fontWeight: '500'
          }}>
            {card.suit}
          </div>
          <div style={{ 
            position: 'absolute', 
            bottom: 3, 
            right: 4, 
            fontSize: sizes.corner, 
            fontWeight: 'bold', 
            color: isFrime ? '#a78bfa' : (isRed ? '#dc2626' : '#1f2937'),
            transform: 'rotate(180deg)',
            lineHeight: 1
          }}>
            {card.value}
          </div>
        </>
      )}
      {isFrime && (
        <div style={{ 
          position: 'absolute', 
          bottom: 1, 
          fontSize: sizes.frime, 
          color: '#a78bfa', 
          fontWeight: 'bold',
          letterSpacing: 0.5
        }}>
          FRIME
        </div>
      )}
  </div>
  )
}

const DiscardPile = ({ cards, canClick, onClickCard }) => {
  const scrollRef = useRef(null)
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [cards.length])

  return (
    <div 
      ref={scrollRef}
      style={{ 
        display: 'flex', 
        gap: 8, 
        overflowX: 'auto',
        overflowY: 'hidden',
        padding: '12px 16px',
        background: 'rgba(139,92,246,0.1)',
        borderRadius: 12,
        border: '2px solid rgba(139,92,246,0.3)',
        minHeight: 90,
        alignItems: 'center'
      }}
    >
      {cards.length === 0 ? (
        <span style={{ color: '#666', fontSize: 16, fontStyle: 'italic' }}>Défausse vide</span>
      ) : (
        cards.map((card, i) => (
          <Card 
            key={card.id} 
            card={card} 
            mini
            onClick={() => onClickCard(i)}
            disabled={!canClick}
            style={{ 
              opacity: canClick ? 1 : 0.7,
              border: canClick ? '2px solid rgba(0,255,136,0.5)' : undefined
            }}
            animClass={i === cards.length - 1 ? 'slide-in' : ''}
          />
        ))
      )}
    </div>
  )
}

// ============ MAIN APP ============
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
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [lastAction, setLastAction] = useState(null)
  const [nameInput, setNameInput] = useState('')

  const stateRef = useRef({})
  const unsubscribeRef = useRef(null)

  useEffect(() => { stateRef.current = { players, deck, discard, melds, scores, currentPlayer, turnPhase, gamePhase, actionLog, message, roundNumber } }, [players, deck, discard, melds, scores, currentPlayer, turnPhase, gamePhase, actionLog, message, roundNumber])

  // Simple auth - check localStorage on mount
  useEffect(() => {
    const savedName = localStorage.getItem('lechartrand_player_name')
    const savedId = localStorage.getItem('lechartrand_player_id')
    
    if (savedName && savedId) {
      setPlayerName(savedName)
      setPlayerId(savedId)
      setIsLoggedIn(true)
    }
    
    setFirebaseAvailable(firebaseService.isFirebaseAvailable())
    const params = new URLSearchParams(window.location.search)
    const room = params.get('room')
    if (room && room.length === 3) setJoinCode(room)
  }, [])

  const handleSimpleLogin = () => {
    const name = nameInput.trim()
    if (!name || name.length < 2) {
      setMessage('Entre ton prénom (minimum 2 lettres)')
      return
    }
    
    // Generate unique ID
    let id = localStorage.getItem('lechartrand_player_id')
    if (!id) {
      id = 'player_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now()
    }
    
    localStorage.setItem('lechartrand_player_name', name)
    localStorage.setItem('lechartrand_player_id', id)
    
    setPlayerName(name)
    setPlayerId(id)
    setIsLoggedIn(true)
    setMessage('')
  }

  const handleLogout = () => {
    localStorage.removeItem('lechartrand_player_name')
    setPlayerName('')
    setIsLoggedIn(false)
    setNameInput('')
  }

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

  const joinRoom = async () => { if (!joinCode || joinCode.length !== 3) return; const code = joinCode; if (!await firebaseService.checkRoomExists(code)) { setMessage('Salon introuvable'); return }; const player = { id: playerId, name: playerName || 'Joueur', isHost: false }; const result = await firebaseService.joinRoom(code, player); if (result.success) { setRoomCode(code); setGameMode('online'); setIsHost(false); setGamePhase('lobby'); subscribeToRoom(code) } else setMessage('Erreur: ' + result.error) }

  const startSoloGame = () => { setGameMode('solo'); const numDecks = numPlayers === 4 ? 2 : 1; const newDeck = createDeck(numDecks, Date.now()); const newPlayers = []; for (let i = 0; i < numPlayers; i++) newPlayers.push({ id: i === 0 ? playerId : `ai_${i}`, name: i === 0 ? (playerName || 'Toi') : `Ordi ${i}`, hand: newDeck.splice(0, 9), isHuman: i === 0, isAI: i !== 0 }); setPlayers(newPlayers); setDeck(newDeck); setDiscard(newDeck.splice(0, 1)); setMelds([]); setCurrentPlayer(0); setTurnPhase('draw'); setSelectedCards([]); setGamePhase('playing'); setMessage('Ton tour - Pioche'); setActionLog([]); setScores(new Array(numPlayers).fill(0)) }

  const startMultiplayerGame = async () => { if (players.length < 2 || !isHost) return; const numDecks = players.length === 4 ? 2 : 1; const newDeck = createDeck(numDecks, Date.now()); const newPlayers = players.map(p => ({ ...p, hand: newDeck.splice(0, 9) })); const topCard = newDeck.splice(0, 1); const newScores = new Array(players.length).fill(0); const msg = `Tour de ${newPlayers[0].name}`; setPlayers(newPlayers); setDeck(newDeck); setDiscard(topCard); setMelds([]); setCurrentPlayer(0); setTurnPhase('draw'); setSelectedCards([]); setGamePhase('playing'); setScores(newScores); setActionLog([]); setRoundNumber(1); setMessage(msg); await firebaseService.updateRoomStatus(roomCode, 'playing'); await firebaseService.updateGameState(roomCode, { players: newPlayers, deck: newDeck, discard: topCard, melds: [], scores: newScores, currentPlayer: 0, turnPhase: 'draw', gamePhase: 'playing', actionLog: [], message: msg, roundNumber: 1 }) }

  const myPlayerIndex = players.findIndex(p => p.id === playerId)
  const isMyTurn = currentPlayer === myPlayerIndex

  const drawFromDeck = async () => { 
    if (turnPhase !== 'draw' || !isMyTurn) return
    setLastAction('draw')
    const newDeck = [...deck]; const card = newDeck.pop(); const newPlayers = [...players]; newPlayers[myPlayerIndex] = { ...newPlayers[myPlayerIndex], hand: [...newPlayers[myPlayerIndex].hand, card] }; const newLog = [...actionLog, { player: players[myPlayerIndex].name, action: 'pioche', icon: '+' }]; setDeck(newDeck); setPlayers(newPlayers); setTurnPhase('play'); setActionLog(newLog); setMessage('Pose ou défausse'); if (gameMode === 'online') await syncToFirebase({ deck: newDeck, players: newPlayers, turnPhase: 'play', actionLog: newLog, message: 'Pose ou défausse' }) 
  }

  const drawFromDiscard = async (idx) => { 
    if (turnPhase !== 'draw' || !isMyTurn) return
    setLastAction('drawDiscard')
    const cardsToTake = discard.slice(idx); const remaining = discard.slice(0, idx); const newPlayers = [...players]; newPlayers[myPlayerIndex] = { ...newPlayers[myPlayerIndex], hand: [...newPlayers[myPlayerIndex].hand, ...cardsToTake] }; const newLog = [...actionLog, { player: players[myPlayerIndex].name, action: cardsToTake.length > 1 ? `+${cardsToTake.length}` : cardsToTake[0].value + cardsToTake[0].suit, icon: '+' }]; setDiscard(remaining); setPlayers(newPlayers); setTurnPhase('play'); setActionLog(newLog); setMessage('Pose ou défausse'); if (gameMode === 'online') await syncToFirebase({ discard: remaining, players: newPlayers, turnPhase: 'play', actionLog: newLog }) 
  }

  const toggleCard = (card) => { if (!isMyTurn || turnPhase !== 'play') return; setSelectedCards(prev => prev.some(c => c.id === card.id) ? prev.filter(c => c.id !== card.id) : [...prev, card]) }

  const createMeld = async () => { 
    if (selectedCards.length < 3 || !isValidMeld(selectedCards)) { setMessage('Combinaison invalide!'); setLastAction('error'); return }
    setLastAction('meld')
    const newMelds = [...melds, { owner: myPlayerIndex, cards: [...selectedCards] }]; const newPlayers = [...players]; newPlayers[myPlayerIndex] = { ...newPlayers[myPlayerIndex], hand: newPlayers[myPlayerIndex].hand.filter(c => !selectedCards.some(s => s.id === c.id)) }; const newLog = [...actionLog, { player: players[myPlayerIndex].name, action: 'pose', icon: '*' }]; setMelds(newMelds); setPlayers(newPlayers); setSelectedCards([]); setActionLog(newLog); if (newPlayers[myPlayerIndex].hand.length === 0) await endRound(newPlayers, newMelds, newLog); else if (gameMode === 'online') await syncToFirebase({ melds: newMelds, players: newPlayers, actionLog: newLog }) 
  }

  const addToMeld = async (meldIdx) => { 
    if (selectedCards.length !== 1) return; const card = selectedCards[0]; const meld = melds[meldIdx]; if (!canAddToMeld(meld.cards, card)) return
    setLastAction('addMeld')
    const newMelds = [...melds]; newMelds[meldIdx] = { ...meld, cards: [...meld.cards, card] }; const newPlayers = [...players]; newPlayers[myPlayerIndex] = { ...newPlayers[myPlayerIndex], hand: newPlayers[myPlayerIndex].hand.filter(c => c.id !== card.id) }; const newLog = [...actionLog, { player: players[myPlayerIndex].name, action: '+' + card.value, icon: '+' }]; setMelds(newMelds); setPlayers(newPlayers); setSelectedCards([]); setActionLog(newLog); if (newPlayers[myPlayerIndex].hand.length === 0) await endRound(newPlayers, newMelds, newLog); else if (gameMode === 'online') await syncToFirebase({ melds: newMelds, players: newPlayers, actionLog: newLog }) 
  }

  const discardCard = async () => { 
    if (selectedCards.length !== 1) return; const card = selectedCards[0]
    setLastAction('discard')
    const newPlayers = [...players]; newPlayers[myPlayerIndex] = { ...newPlayers[myPlayerIndex], hand: newPlayers[myPlayerIndex].hand.filter(c => c.id !== card.id) }; const newDiscard = [...discard, card]; const newLog = [...actionLog, { player: players[myPlayerIndex].name, action: card.value + card.suit, icon: '-' }]; setPlayers(newPlayers); setDiscard(newDiscard); setSelectedCards([]); setActionLog(newLog); if (newPlayers[myPlayerIndex].hand.length === 0) await endRound(newPlayers, melds, newLog); else { const next = (currentPlayer + 1) % players.length; const msg = `Tour de ${newPlayers[next].name}`; setCurrentPlayer(next); setTurnPhase('draw'); setMessage(msg); if (gameMode === 'online') await syncToFirebase({ players: newPlayers, discard: newDiscard, currentPlayer: next, turnPhase: 'draw', actionLog: newLog, message: msg }) } 
  }

  const endRound = async (finalPlayers, finalMelds, newLog) => { const newScores = [...scores]; finalPlayers.forEach((p, i) => { const mPts = finalMelds.filter(m => m.owner === i).reduce((s, m) => s + m.cards.reduce((ss, c) => ss + getCardPoints(c), 0), 0); newScores[i] += mPts - p.hand.reduce((s, c) => s + getCardPoints(c), 0) }); setScores(newScores); const newPhase = newScores.some(s => s >= 500) ? 'gameEnd' : 'roundEnd'; setGamePhase(newPhase); if (gameMode === 'online') await syncToFirebase({ scores: newScores, gamePhase: newPhase, actionLog: newLog }) }

  useEffect(() => {
    if (gamePhase !== 'playing' || gameMode !== 'solo' || !players[currentPlayer]?.isAI) return
    const timer = setTimeout(() => {
      const st = stateRef.current; let newPlayers = JSON.parse(JSON.stringify(st.players)); let newDeck = [...st.deck]; let newDiscard = [...st.discard]; let newMelds = JSON.parse(JSON.stringify(st.melds)); const logs = []; const pName = newPlayers[currentPlayer].name
      if (newDeck.length > 0) { newPlayers[currentPlayer].hand.push(newDeck.pop()); logs.push({ player: pName, action: 'pioche', icon: '+' }) }
      let found = true, iter = 0; while (found && iter < 5) { found = false; iter++; const hand = newPlayers[currentPlayer].hand; for (let i = 0; i < hand.length && !found; i++) for (let j = i + 1; j < hand.length && !found; j++) for (let k = j + 1; k < hand.length && !found; k++) { const tryM = [hand[i], hand[j], hand[k]]; if (isValidMeld(tryM)) { newMelds.push({ owner: currentPlayer, cards: tryM }); newPlayers[currentPlayer].hand = hand.filter(c => !tryM.some(m => m.id === c.id)); logs.push({ player: pName, action: 'pose', icon: '*' }); found = true } } }
      if (newPlayers[currentPlayer].hand.length > 0) { const sorted = [...newPlayers[currentPlayer].hand].sort((a, b) => getCardPoints(b) - getCardPoints(a)); const disc = sorted[0]; newPlayers[currentPlayer].hand = newPlayers[currentPlayer].hand.filter(c => c.id !== disc.id); newDiscard.push(disc); logs.push({ player: pName, action: disc.value + disc.suit, icon: '-' }) }
      setPlayers(newPlayers); setDeck(newDeck); setDiscard(newDiscard); setMelds(newMelds); setActionLog(prev => [...prev, ...logs])
      if (newPlayers[currentPlayer].hand.length === 0) { const newScores = [...st.scores]; newPlayers.forEach((p, i) => { const mPts = newMelds.filter(m => m.owner === i).reduce((s, m) => s + m.cards.reduce((ss, c) => ss + getCardPoints(c), 0), 0); newScores[i] += mPts - p.hand.reduce((s, c) => s + getCardPoints(c), 0) }); setScores(newScores); setGamePhase(newScores.some(s => s >= 500) ? 'gameEnd' : 'roundEnd') }
      else { const next = (currentPlayer + 1) % numPlayers; setCurrentPlayer(next); setTurnPhase('draw'); setMessage(next === 0 ? 'Ton tour - Pioche' : `Tour de ${newPlayers[next].name}...`) }
    }, 800)
    return () => clearTimeout(timer)
  }, [currentPlayer, gamePhase, gameMode, numPlayers])

  const sortedHand = () => { const myPlayer = players[myPlayerIndex]; if (!myPlayer) return []; const hand = [...myPlayer.hand]; if (sortMode === 'value') { const order = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'JOKER']; hand.sort((a, b) => order.indexOf(a.value) - order.indexOf(b.value)) } else if (sortMode === 'suit') { const suitOrder = ['♠', '♥', '♦', '♣', 'R', 'B']; const valOrder = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'JOKER']; hand.sort((a, b) => { const sd = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit); return sd !== 0 ? sd : valOrder.indexOf(a.value) - valOrder.indexOf(b.value) }) }; return hand }

  const copyRoomLink = () => { navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?room=${roomCode}`); setMessage('Lien copié!'); setTimeout(() => setMessage(''), 2000) }

  // ============ RENDER ============
  
  // LOGIN - Simple name entry
  if (!isLoggedIn && gamePhase === 'menu') return (
    <>
      <GlobalStyles />
      <div style={{ height: '100vh', background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f23 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk, system-ui', color: '#fff', padding: 20 }}>
        <div style={{ marginBottom: 50, textAlign: 'center' }}>
          <h1 style={{ fontSize: 'clamp(36px, 10vw, 64px)', background: 'linear-gradient(135deg, #00ff88, #00d4ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 8, fontWeight: 700 }}>LE CHARTRAND</h1>
          <p style={{ color: '#666', fontSize: 'clamp(14px, 3vw, 18px)', letterSpacing: 2 }}>RAMI 500</p>
        </div>
        
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 'clamp(28px, 6vw, 44px)', border: '1px solid rgba(255,255,255,0.08)', width: 'min(90vw, 360px)', textAlign: 'center', backdropFilter: 'blur(10px)' }}>
          <div style={{ marginBottom: 28 }}>
            <div className="bounce-in" style={{ fontSize: 48, marginBottom: 16, fontWeight: 700, color: '#00ff88' }}>♠♥♦♣</div>
            <p style={{ color: '#aaa', fontSize: 16, fontWeight: 500 }}>Bienvenue !</p>
            <p style={{ color: '#666', fontSize: 13, marginTop: 8 }}>Entre ton prénom pour jouer</p>
          </div>
          
          <input
            type="text"
            placeholder="Ton prénom..."
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSimpleLogin()}
            autoFocus
            style={{
              width: '100%',
              padding: '16px 20px',
              borderRadius: 12,
              border: '2px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: '#fff',
              fontSize: 18,
              textAlign: 'center',
              fontWeight: 500,
              marginBottom: 16,
              outline: 'none',
              transition: 'all 0.2s ease'
            }}
          />
          
          <button 
            onClick={handleSimpleLogin}
            className="btn-primary"
            style={{ 
              width: '100%', 
              padding: '16px 24px', 
              borderRadius: 12, 
              border: 'none', 
              background: 'linear-gradient(135deg, #00ff88, #00d4ff)', 
              color: '#000', 
              fontSize: 17, 
              fontWeight: '600', 
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Jouer
          </button>
          
          {message && <div className="shake" style={{ marginTop: 20, color: '#ff5757', fontSize: 13 }}>{message}</div>}
        </div>
        
        <p style={{ position: 'absolute', bottom: 20, fontSize: 11, color: '#444' }}>v1.1 • Massive Medias • Montréal</p>
      </div>
    </>
  )

  // MENU (logged in)
  if (gamePhase === 'menu') return (
    <>
      <GlobalStyles />
      <div style={{ height: '100vh', background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f23 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk, system-ui', color: '#fff', padding: 20 }}>
        <h1 style={{ fontSize: 'clamp(32px, 8vw, 52px)', background: 'linear-gradient(135deg, #00ff88, #00d4ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 4, fontWeight: 700 }}>LE CHARTRAND</h1>
        <p style={{ color: '#666', marginBottom: 24, fontSize: 13, letterSpacing: 2 }}>RAMI 500</p>
        
        {/* User info */}
        <div className="slide-in" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, background: 'rgba(255,255,255,0.05)', padding: '12px 20px', borderRadius: 25, border: '1px solid rgba(255,255,255,0.1)' }}>
          <span style={{ fontSize: 18, color: '#00ff88' }}>●</span>
          <span style={{ fontSize: 16, color: '#fff', fontWeight: 500 }}>{playerName}</span>
          <button onClick={handleLogout} className="btn-primary" style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.1)', color: '#888', fontSize: 11, cursor: 'pointer' }}>Changer</button>
        </div>

        <div style={{ display: 'flex', gap: 16, flexDirection: 'column', width: 'min(90vw, 300px)' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>Solo vs IA</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, justifyContent: 'center' }}>
              {[2, 3, 4].map(n => (
                <button 
                  key={n} 
                  onClick={() => setNumPlayers(n)} 
                  className="btn-primary"
                  style={{ 
                    width: 50, height: 50, borderRadius: 10, border: 'none', 
                    background: numPlayers === n ? 'linear-gradient(135deg, #00ff88, #00d4ff)' : 'rgba(255,255,255,0.08)', 
                    color: numPlayers === n ? '#000' : '#888', 
                    fontSize: 18, fontWeight: 'bold', cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            <button onClick={startSoloGame} className="btn-primary" style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Jouer</button>
          </div>
          
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              👥 Multijoueur 
              <span style={{ fontSize: 9, padding: '3px 8px', borderRadius: 6, background: 'rgba(0,255,136,0.15)', color: '#00ff88' }}>ONLINE</span>
            </div>
            <button onClick={createRoom} className="btn-primary" style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #00ff88, #00d4ff)', color: '#000', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 10 }}>Créer une partie</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="123" value={joinCode} onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 3))} style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 18, textAlign: 'center', letterSpacing: 6, fontWeight: 600, maxWidth: 100 }} />
              <button onClick={joinRoom} disabled={joinCode.length !== 3} className="btn-primary" style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: joinCode.length === 3 ? '#00ff88' : 'rgba(255,255,255,0.08)', color: joinCode.length === 3 ? '#000' : '#555', fontWeight: 600, fontSize: 13, cursor: joinCode.length === 3 ? 'pointer' : 'not-allowed' }}>OK</button>
            </div>
          </div>
        </div>
        
        {message && <div className="shake" style={{ marginTop: 20, color: '#ff5757', fontSize: 13 }}>{message}</div>}
        <p style={{ position: 'absolute', bottom: 20, fontSize: 11, color: '#444' }}>v1.0 • Massive Medias</p>
      </div>
    </>
  )

  // LOBBY
  if (gamePhase === 'lobby') return (
    <>
      <GlobalStyles />
      <div style={{ height: '100vh', background: 'linear-gradient(135deg, #0a0a0f, #1a1a2e)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk, system-ui', color: '#fff', padding: 20 }}>
        <h2 style={{ fontSize: 24, marginBottom: 10, fontWeight: 600 }}>Salon de jeu</h2>
        <div className="glow" style={{ background: 'rgba(139,92,246,0.15)', padding: '14px 28px', borderRadius: 12, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14, border: '1px solid rgba(139,92,246,0.3)' }}>
          <span style={{ fontSize: 28, fontWeight: 'bold', letterSpacing: 4, color: '#00ff88' }}>{roomCode}</span>
          <button onClick={copyRoomLink} className="btn-primary" style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, cursor: 'pointer' }}>Copier</button>
        </div>
        {message && <div style={{ color: '#00ff88', marginBottom: 12, fontSize: 12 }}>{message}</div>}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 20, marginBottom: 20, minWidth: 260, border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 12, fontWeight: 500 }}>Joueurs ({players.length}/4)</div>
          {players.map((p, i) => (
            <div key={p.id} className="slide-in" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', animationDelay: `${i * 100}ms` }}>
              <span style={{ fontSize: 14, color: p.isHost ? '#00ff88' : '#666' }}>{p.isHost ? '★' : '•'}</span>
              <span style={{ color: p.id === playerId ? '#00ff88' : '#fff', fontSize: 14, fontWeight: 500 }}>{p.name}</span>
              {p.id === playerId && <span style={{ fontSize: 10, color: '#666' }}>(toi)</span>}
            </div>
          ))}
          {players.length < 4 && <div className="pulse" style={{ padding: '10px 0', color: '#444', fontSize: 13 }}>En attente de joueurs...</div>}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => { setGamePhase('menu'); setRoomCode(''); firebaseService.leaveRoom(roomCode, playerId) }} className="btn-primary" style={{ padding: '12px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#888', fontSize: 13, cursor: 'pointer' }}>Quitter</button>
          {isHost && <button onClick={startMultiplayerGame} disabled={players.length < 2} className="btn-primary" style={{ padding: '12px 28px', borderRadius: 10, border: 'none', background: players.length >= 2 ? 'linear-gradient(135deg, #00ff88, #00d4ff)' : 'rgba(255,255,255,0.08)', color: players.length >= 2 ? '#000' : '#555', fontWeight: 600, fontSize: 13, cursor: players.length >= 2 ? 'pointer' : 'not-allowed' }}>Commencer</button>}
        </div>
    </div>
    </>
  )

  // END
  if (gamePhase === 'roundEnd' || gamePhase === 'gameEnd') { 
    const winner = scores.indexOf(Math.max(...scores))
    return (
      <>
        <GlobalStyles />
        <div style={{ height: '100vh', background: 'linear-gradient(135deg, #0a0a0f, #1a1a2e)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk, system-ui', color: '#fff', padding: 20 }}>
          <h2 className="bounce-in" style={{ fontSize: 28, marginBottom: 20, color: gamePhase === 'gameEnd' ? '#00ff88' : '#fff', fontWeight: 600 }}>
            {gamePhase === 'gameEnd' ? 'Partie terminée!' : `Fin de la manche ${roundNumber}`}
          </h2>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 24, marginBottom: 24, minWidth: 280, border: '1px solid rgba(255,255,255,0.08)' }}>
            {players.map((p, i) => (
              <div key={i} className="slide-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', color: i === winner ? '#00ff88' : '#fff', fontSize: 15, animationDelay: `${i * 100}ms` }}>
                <span style={{ fontWeight: i === winner ? 600 : 400 }}>{p.name} {i === winner && '★'}</span>
                <span style={{ fontWeight: 600, fontSize: 18 }}>{scores[i]} pts</span>
              </div>
            ))}
          </div>
          <button 
            onClick={async () => { if (gamePhase === 'gameEnd') { if (gameMode === 'online' && roomCode) await firebaseService.deleteRoom(roomCode); setScores([]); setRoundNumber(1); setGamePhase('menu'); setRoomCode('') } else { setRoundNumber(r => r + 1); if (gameMode === 'solo') startSoloGame(); else if (isHost) startMultiplayerGame() } }} 
            className="btn-primary"
            style={{ padding: '14px 32px', borderRadius: 12, border: 'none', background: gamePhase === 'gameEnd' ? 'linear-gradient(135deg, #00ff88, #00d4ff)' : 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: gamePhase === 'gameEnd' ? '#000' : '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
          >
            {gamePhase === 'gameEnd' ? 'Retour au menu' : (isHost || gameMode === 'solo' ? 'Manche suivante' : 'En attente...')}
          </button>
    </div>
      </>
    )
  }

  // ============ GAME ============
  const myMelds = melds.filter(m => m.owner === myPlayerIndex)
  const canClickDiscard = isMyTurn && turnPhase === 'draw'
  const otherPlayers = players.filter((_, i) => i !== myPlayerIndex)
  const validSelection = selectedCards.length >= 3 && isValidMeld(selectedCards)

  return (
    <>
      <GlobalStyles />
      <div style={{ 
        height: '100vh', 
        background: 'linear-gradient(180deg, #0a0a0f 0%, #12122a 50%, #0a0a0f 100%)', 
        fontFamily: 'Space Grotesk, system-ui', 
        color: '#fff', 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ 
          padding: '16px 24px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: 'rgba(0,0,0,0.3)',
          borderBottom: '1px solid rgba(255,255,255,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <h1 style={{ fontSize: 22, background: 'linear-gradient(135deg, #00ff88, #00d4ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0, fontWeight: 700 }}>LE CHARTRAND</h1>
            {roomCode && <span style={{ fontSize: 14, color: '#888', background: 'rgba(139,92,246,0.2)', padding: '6px 12px', borderRadius: 6 }}>{roomCode}</span>}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {players.map((p, i) => (
              <div key={i} style={{ 
                padding: '10px 18px', 
                background: currentPlayer === i ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.03)', 
                borderRadius: 10, 
                border: currentPlayer === i ? '2px solid rgba(0,255,136,0.4)' : '1px solid transparent',
                transition: 'all 0.3s ease'
              }}>
                <div style={{ fontSize: 14, color: currentPlayer === i ? '#00ff88' : '#888', fontWeight: 500 }}>{p.name}</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{scores[i]}p</div>
              </div>
            ))}
          </div>
        </div>

        {/* Status bar */}
        <div className={lastAction === 'error' ? 'shake' : ''} style={{ 
          textAlign: 'center', 
          padding: '14px 24px', 
          background: isMyTurn ? 'rgba(0,255,136,0.1)' : 'rgba(139,92,246,0.1)', 
          borderBottom: isMyTurn ? '3px solid rgba(0,255,136,0.4)' : '1px solid rgba(139,92,246,0.2)',
          fontSize: 18,
          fontWeight: 600,
          color: isMyTurn ? '#00ff88' : '#a78bfa'
        }}>
          {message}
        </div>

        {/* Main game area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20, gap: 20, overflow: 'hidden' }}>
          
          {/* Opponents row */}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            {otherPlayers.map((p) => { 
              const pIdx = players.indexOf(p)
              const pMelds = melds.filter(m => m.owner === pIdx)
              const isActive = currentPlayer === pIdx
              return (
                <div key={p.id} style={{ 
                  background: isActive ? 'rgba(0,255,136,0.08)' : 'rgba(255,255,255,0.02)', 
                  borderRadius: 16, 
                  padding: 18, 
                  border: isActive ? '2px solid rgba(0,255,136,0.3)' : '1px solid rgba(255,255,255,0.05)',
                  minWidth: 180,
                  transition: 'all 0.3s ease'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 600, color: isActive ? '#00ff88' : '#fff' }}>{p.name}</span>
                    <span style={{ fontSize: 14, color: '#888', background: 'rgba(255,255,255,0.08)', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>{p.hand?.length || 0} cartes</span>
                  </div>
                  <div style={{ display: 'flex', marginBottom: 8 }}>
                    {(p.hand || []).slice(0, 5).map((_, i) => <Card key={i} faceDown mini style={{ marginLeft: i > 0 ? -20 : 0 }} />)}
                    {(p.hand?.length || 0) > 5 && <div style={{ marginLeft: -14, background: '#2d2d44', borderRadius: 6, padding: '2px 8px', fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', fontWeight: 600 }}>+{p.hand.length - 5}</div>}
                  </div>
                  {pMelds.length > 0 && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12, marginTop: 8 }}>
                      {pMelds.map((m, mi) => (
                        <div 
                          key={mi} 
                          style={{ 
                            display: 'flex', 
                            marginBottom: 6, 
                            padding: 6,
                            borderRadius: 8,
                            cursor: selectedCards.length === 1 && canAddToMeld(m.cards, selectedCards[0]) ? 'pointer' : 'default', 
                            border: selectedCards.length === 1 && canAddToMeld(m.cards, selectedCards[0]) ? '2px dashed #00ff88' : '1px solid rgba(255,255,255,0.05)',
                            background: 'rgba(0,0,0,0.2)'
                          }} 
                          onClick={() => selectedCards.length === 1 && canAddToMeld(m.cards, selectedCards[0]) && addToMeld(melds.indexOf(m))}
                        >
                          {m.cards.map((c, ci) => <Card key={c.id} card={c} mini style={{ marginLeft: ci > 0 ? -18 : 0 }} disabled />)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Center: Deck & Discard */}
          <div style={{ display: 'flex', gap: 30, justifyContent: 'center', alignItems: 'flex-start', flex: 1, minHeight: 0 }}>

            {/* Deck & Discard area */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', flex: 1, maxWidth: 600 }}>
              <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start' }}>
                {/* Deck */}
                <div 
                  onClick={canClickDiscard ? drawFromDeck : undefined} 
                  style={{ textAlign: 'center', cursor: canClickDiscard ? 'pointer' : 'default' }}
                >
                  <div style={{ fontSize: 14, color: '#888', marginBottom: 10, fontWeight: 600 }}>Pioche</div>
                  <div className={canClickDiscard ? 'glow' : ''} style={{ position: 'relative' }}>
                    <Card faceDown />
                    {canClickDiscard && <div style={{ position: 'absolute', inset: -4, borderRadius: 10, border: '3px solid rgba(0,255,136,0.5)' }} />}
                  </div>
                  <div style={{ fontSize: 14, color: '#666', marginTop: 8, fontWeight: 500 }}>{deck.length} cartes</div>
                </div>

                {/* Discard */}
                <div style={{ flex: 1, maxWidth: 400 }}>
                  <div style={{ fontSize: 14, color: '#888', marginBottom: 10, fontWeight: 600 }}>Défausse ({discard.length})</div>
                  <DiscardPile cards={discard} canClick={canClickDiscard} onClickCard={drawFromDiscard} />
                  {canClickDiscard && discard.length > 0 && <div style={{ fontSize: 13, color: '#666', marginTop: 8, textAlign: 'center' }}>Clique sur une carte pour prendre toutes les suivantes</div>}
                </div>
              </div>

              {/* My melds */}
              {myMelds.length > 0 && (
                <div style={{ width: '100%' }}>
                  <div style={{ fontSize: 14, color: '#888', marginBottom: 10, fontWeight: 600 }}>Tes combinaisons</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
                    {myMelds.map((m, mi) => (
                      <div 
                        key={mi} 
                        className={lastAction === 'meld' && mi === myMelds.length - 1 ? 'meld-success' : ''}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          background: 'rgba(0,255,136,0.08)', 
                          borderRadius: 8, 
                          padding: 6, 
                          border: selectedCards.length === 1 && canAddToMeld(m.cards, selectedCards[0]) ? '2px dashed #00ff88' : '1px solid rgba(0,255,136,0.2)',
                          cursor: selectedCards.length === 1 && canAddToMeld(m.cards, selectedCards[0]) ? 'pointer' : 'default' 
                        }} 
                        onClick={() => selectedCards.length === 1 && canAddToMeld(m.cards, selectedCards[0]) && addToMeld(melds.indexOf(m))}
                      >
                        {m.cards.map((c, ci) => <Card key={c.id} card={c} small style={{ marginLeft: ci > 0 ? -20 : 0 }} disabled />)}
                        <div style={{ marginLeft: 12, fontSize: 16, color: '#00ff88', fontWeight: 700 }}>{m.cards.reduce((s, c) => s + getCardPoints(c), 0)}p</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Player's hand area */}
        <div style={{ 
          background: 'rgba(0,0,0,0.4)', 
          borderTop: isMyTurn ? '3px solid rgba(0,255,136,0.5)' : '1px solid rgba(255,255,255,0.08)',
          padding: '20px 24px 28px'
        }}>
          {/* Hand header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ color: '#aaa', fontSize: 18, fontWeight: 600 }}>Ta main ({players[myPlayerIndex]?.hand?.length || 0})</span>
              {selectedCards.length > 0 && (
                <span style={{ 
                  color: validSelection ? '#00ff88' : '#a78bfa', 
                  fontSize: 16, 
                  background: validSelection ? 'rgba(0,255,136,0.15)' : 'rgba(139,92,246,0.15)',
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontWeight: 600
                }}>
                  {selectedCards.length} sélectionnées {validSelection && '✓'}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['none', 'value', 'suit'].map(mode => (
                <button 
                  key={mode} 
                  onClick={() => setSortMode(mode)} 
                  className="btn-primary"
                  style={{ 
                    padding: '10px 18px', 
                    borderRadius: 8, 
                    border: 'none', 
                    background: sortMode === mode ? 'rgba(0,255,136,0.2)' : 'rgba(255,255,255,0.05)', 
                    color: sortMode === mode ? '#00ff88' : '#888', 
                    fontSize: 14, 
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  {mode === 'none' ? 'Défaut' : mode === 'value' ? 'Valeur' : 'Couleur'}
                </button>
              ))}
            </div>
          </div>

          {/* Cards */}
          <div style={{ 
            display: 'flex', 
            gap: 12, 
            justifyContent: 'center', 
            flexWrap: 'wrap',
            marginBottom: isMyTurn && turnPhase === 'play' ? 24 : 0
          }}>
            {sortedHand().map((card, i) => (
              <Card 
                key={card.id} 
                card={card} 
                selected={selectedCards.some(c => c.id === card.id)} 
                onClick={() => toggleCard(card)} 
                disabled={!isMyTurn || turnPhase !== 'play'}
                delay={i * 30}
              />
            ))}
          </div>

          {/* Action buttons */}
          {isMyTurn && turnPhase === 'play' && (
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button 
                onClick={createMeld} 
                disabled={!validSelection}
                className="btn-primary"
                style={{ 
                  padding: '16px 40px', 
                  borderRadius: 12, 
                  border: 'none', 
                  background: validSelection ? 'linear-gradient(135deg, #00ff88, #00d4ff)' : 'rgba(255,255,255,0.08)', 
                  color: validSelection ? '#000' : '#555', 
                  fontWeight: 700, 
                  fontSize: 18, 
                  cursor: validSelection ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s ease'
                }}
              >
                Poser
              </button>
              <button 
                onClick={discardCard} 
                disabled={selectedCards.length !== 1}
                className="btn-primary"
                style={{ 
                  padding: '16px 40px', 
                  borderRadius: 12, 
                  border: 'none', 
                  background: selectedCards.length === 1 ? 'linear-gradient(135deg, #ff4757, #ff6b81)' : 'rgba(255,255,255,0.08)', 
                  color: selectedCards.length === 1 ? '#fff' : '#555', 
                  fontWeight: 700, 
                  fontSize: 18, 
                  cursor: selectedCards.length === 1 ? 'pointer' : 'not-allowed'
                }}
              >
                Défausser
              </button>
              <button 
                onClick={() => setSelectedCards([])} 
                className="btn-primary"
                style={{ 
                  padding: '16px 32px', 
                  borderRadius: 12, 
                  border: '2px solid rgba(255,255,255,0.2)', 
                  background: 'transparent', 
                  color: '#888', 
                  fontSize: 18, 
                  cursor: 'pointer' 
                }}
              >
                Annuler
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
