import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, RefreshCw, Maximize2, X, Timer, Play, Pause } from 'lucide-react';

// --- Constants & Types ---
type GameMode = 'immediate' | 'endOfRound';

interface Config {
  rows: number;
  cols: number;
  skulls: number;
  gameMode: GameMode;
  timerEnabled: boolean;
  timerSeconds: number;
  rowNames: string[];
  showTurnHighlight: boolean;
}

interface CellData {
  id: string;
  isSkull: boolean;
  isRevealed: boolean;
  r: number;
  c: number;
}

const DEFAULT_CONFIG: Config = {
  rows: 4,
  cols: 8,
  skulls: 2,
  gameMode: 'immediate',
  timerEnabled: false,
  timerSeconds: 15,
  rowNames: Array.from({ length: 20 }, (_, i) => `${i + 1}번줄`),
  showTurnHighlight: true,
};

// --- Audio System ---
let audioCtx: AudioContext | null = null;

const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

const playSafeSound = () => {
  initAudio();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.2);
};

const playSkullSound = () => {
  initAudio();
  if (!audioCtx) return;
  const bufferSize = audioCtx.sampleRate * 1.5;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1200, audioCtx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 1.2);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(3.0, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  noise.start();
  const osc = audioCtx.createOscillator();
  const oscGain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + 1.2);
  oscGain.gain.setValueAtTime(2.0, audioCtx.currentTime);
  oscGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);
  osc.connect(oscGain);
  oscGain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 1.2);
};

const playTickSound = (secondsLeft: number) => {
  if (secondsLeft > 10 || secondsLeft < 0) return;
  initAudio();
  if (!audioCtx) return;
  
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  const startTime = now + 0.05;
  
  if (secondsLeft <= 3 && secondsLeft > 0) {
    osc.type = 'square';
    osc.frequency.setValueAtTime(1500, startTime);
    osc.frequency.exponentialRampToValueAtTime(600, startTime + 0.1);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
    gain.gain.linearRampToValueAtTime(0.001, startTime + 0.15);
  } else {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, startTime);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.2, startTime + 0.01);
    gain.gain.linearRampToValueAtTime(0.001, startTime + 0.08);
  }
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(startTime);
  osc.stop(startTime + 0.2);
};

// --- Components ---

const ThickX = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full p-3 text-red-700 drop-shadow-[0_0_8px_rgba(255,0,0,0.9)]">
    <path d="M20,20 L80,80 M80,20 L20,80" stroke="currentColor" strokeWidth="24" strokeLinecap="round" />
  </svg>
);

const ScarierSkull = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full p-1 text-white drop-shadow-[0_0_15px_rgba(255,0,0,0.8)]">
    <path d="M50,5 C20,5 10,30 10,50 C10,65 20,75 30,90 L70,90 C80,75 90,65 90,50 C90,30 80,5 50,5 Z" fill="#1a1a1a" stroke="#444" strokeWidth="2" />
    {/* Glowing Eyes */}
    <motion.circle 
      cx="32" cy="42" r="12" fill="#000" 
      animate={{ fill: ['#000', '#400', '#000'] }}
      transition={{ repeat: Infinity, duration: 2 }}
    />
    <motion.circle 
      cx="68" cy="42" r="12" fill="#000"
      animate={{ fill: ['#000', '#400', '#000'] }}
      transition={{ repeat: Infinity, duration: 2 }}
    />
    <circle cx="32" cy="42" r="4" fill="#ff0000" className="animate-pulse" />
    <circle cx="68" cy="42" r="4" fill="#ff0000" className="animate-pulse" />
    
    <path d="M48,55 L52,55 L50,70 Z" fill="#000" />
    <path d="M30,85 Q50,75 70,85" fill="none" stroke="#000" strokeWidth="6" strokeLinecap="round" />
    <path d="M35,85 L35,75 M45,85 L45,75 M55,85 L55,75 M65,85 L65,75" stroke="#000" strokeWidth="4" strokeLinecap="round" />
    {/* Cracks */}
    <path d="M50,5 L55,15 M20,30 L30,35" stroke="#333" strokeWidth="2" />
  </svg>
);

export default function App() {
  // --- State ---
  const [config, setConfig] = useState<Config>(() => {
    try {
      const saved = localStorage.getItem('avoid_skull_config_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch (e) {
      console.error('Failed to load config', e);
    }
    return DEFAULT_CONFIG;
  });
  
  const [grid, setGrid] = useState<CellData[][]>([]);
  const [currentTurnRow, setCurrentTurnRow] = useState(0);
  const [revealedCountPerRow, setRevealedCountPerRow] = useState<number[]>([]);
  const [failedRows, setFailedRows] = useState<number[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [showGameOverText, setShowGameOverText] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [lastClickedCell, setLastClickedCell] = useState<{r: number, c: number} | null>(null);
  const [pendingGameOver, setPendingGameOver] = useState<{grid: CellData[][], won: boolean} | null>(null);
  const [shake, setShake] = useState(false);
  const [shakeOrigin, setShakeOrigin] = useState({ x: '50%', y: '50%' });
  const [showSettings, setShowSettings] = useState(false);
  const [timeLeft, setTimeLeft] = useState(config.timerSeconds);
  const [isPaused, setIsPaused] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Track window size for real-time relative scaling
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isLandscape = windowSize.width > windowSize.height;
  
  // Available space for the game board (excluding sidebar/header)
  // Sidebar is 15vw in landscape. Header is 18vh in portrait.
  const margin = 20; // Safety margin in pixels
  const availableWidth = isLandscape 
    ? windowSize.width - (windowSize.width * 0.15) - margin 
    : windowSize.width - margin;
  const availableHeight = isLandscape 
    ? windowSize.height - margin 
    : windowSize.height - (windowSize.height * 0.18) - margin;

  // Relative gap size (0.5% of the primary dimension)
  const gapSize = isLandscape ? windowSize.height * 0.005 : windowSize.width * 0.005;

  // The "card set" is a rectangle containing (config.cols + 1) columns and config.rows rows.
  // Total Width = (config.cols + 1) * cardSize + config.cols * gapSize
  // Total Height = config.rows * cardSize + (config.rows - 1) * gapSize
  
  const cardSizeW = (availableWidth - config.cols * gapSize) / (config.cols + 1);
  const cardSizeH = (availableHeight - (config.rows - 1) * gapSize) / config.rows;
  
  // Maximize card size without clipping (min of constraints)
  const cardSize = Math.max(10, Math.min(cardSizeW, cardSizeH));

  // Persistence
  useEffect(() => {
    localStorage.setItem('avoid_skull_config_v2', JSON.stringify(config));
  }, [config]);

  // --- Game Logic ---
  const initGame = useCallback(() => {
    initAudio();
    const newGrid: CellData[][] = [];
    for (let r = 0; r < config.rows; r++) {
      const row: CellData[] = Array(config.cols).fill(null).map((_, c) => ({
        id: `${r}-${c}`, r, c, isSkull: false, isRevealed: false
      }));
      let skullsPlaced = 0;
      while (skullsPlaced < config.skulls) {
        const idx = Math.floor(Math.random() * config.cols);
        if (!row[idx].isSkull) {
          row[idx].isSkull = true;
          skullsPlaced++;
        }
      }
      newGrid.push(row);
    }
    setGrid(newGrid);
    setCurrentTurnRow(0);
    setRevealedCountPerRow(Array(config.rows).fill(0));
    setFailedRows([]);
    setGameOver(false);
    setShowGameOverText(false);
    setGameWon(false);
    setLastClickedCell(null);
    setPendingGameOver(null);
    setShake(false);
    setTimeLeft(config.timerSeconds);
    setIsPaused(false);
    setIsInitialized(true);
    setShowSettings(false);
  }, [config]);

  useEffect(() => {
    if (!isInitialized) initGame();
  }, [isInitialized, initGame]);

  // --- Timer Logic ---
  useEffect(() => {
    if (gameOver || gameWon || !config.timerEnabled || isPaused || !isInitialized) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleTimeout();
          return config.timerSeconds;
        }
        playTickSound(prev - 1);
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameOver, gameWon, config.timerEnabled, isPaused, currentTurnRow, isInitialized]);

  const handleTimeout = () => {
    const unrevealed = grid[currentTurnRow].filter(c => !c.isRevealed);
    if (unrevealed.length > 0) {
      const randomCell = unrevealed[Math.floor(Math.random() * unrevealed.length)];
      handleCellClick(randomCell.r, randomCell.c);
    }
  };

  const handleCellClick = (r: number, c: number) => {
    if (gameOver || gameWon || pendingGameOver || !grid[r] || !grid[r][c] || grid[r][c].isRevealed) return;
    
    // If turn-based is active (via highlight or timer), only allow current turn
    if ((config.timerEnabled || config.showTurnHighlight) && r !== currentTurnRow) return;

    setLastClickedCell({ r, c });

    const newGrid = [...grid];
    newGrid[r] = [...newGrid[r]];
    const cell = newGrid[r][c];
    newGrid[r][c] = { ...cell, isRevealed: true };

    // CRITICAL: Always update the grid immediately so the clicked cell reveals
    // This ensures the animation starts and triggers handleAnimationComplete
    setGrid(newGrid);

    const newRevealedCount = [...revealedCountPerRow];
    newRevealedCount[r]++;
    setRevealedCountPerRow(newRevealedCount);

    let updatedFailedRows = [...failedRows];
    let isGameOver = false;

    if (cell.isSkull) {
      playSkullSound();
      setShakeOrigin({ x: `${(c / config.cols) * 100}%`, y: `${(r / config.rows) * 100}%` });
      setShake(true);
      setTimeout(() => setShake(false), 500);

      const skullsInRow = newGrid[r].filter(x => x.isSkull && x.isRevealed).length;
      if (skullsInRow >= config.skulls) {
        if (config.gameMode === 'immediate') {
          setFailedRows([r]);
          setPendingGameOver({ grid: newGrid, won: false });
          isGameOver = true;
        } else {
          if (!updatedFailedRows.includes(r)) {
            updatedFailedRows.push(r);
            setFailedRows(updatedFailedRows);
          }
        }
      }
    } else {
      playSafeSound();
    }

    if (!isGameOver) {
      // Advance turn even if timer is disabled
      if (config.timerEnabled || config.showTurnHighlight) {
        setCurrentTurnRow((r + 1) % config.rows);
        if (config.timerEnabled) setTimeLeft(config.timerSeconds);
      }

      if (config.gameMode === 'endOfRound') {
        const allRowsEqual = newRevealedCount.every(count => count === newRevealedCount[0]);
        if (allRowsEqual && updatedFailedRows.length > 0) {
          setPendingGameOver({ grid: newGrid, won: false });
          isGameOver = true;
        }
      }

      if (!isGameOver) {
        const allSafeRevealed = newGrid.every(row => row.every(cell => cell.isSkull || cell.isRevealed));
        if (allSafeRevealed) {
          setPendingGameOver({ grid: newGrid, won: true });
          isGameOver = true;
        }
      }
    }
  };

  const handleAnimationComplete = (r: number, c: number) => {
    if (lastClickedCell?.r === r && lastClickedCell?.c === c) {
      if (pendingGameOver) {
        endGame(pendingGameOver.grid, pendingGameOver.won);
        setPendingGameOver(null);
      }
    }
  };

  const endGame = async (finalGrid: CellData[][], won: boolean) => {
    if (!won) {
      // 1. Shrink the board (triggers the scale transition)
      setGameOver(true);
      
      // 2. Wait for the board shrink transition to finish (1000ms)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 3. Show the "GAME OVER" text
      setShowGameOverText(true);

      const unrevealedSkulls: { r: number; c: number }[] = [];
      finalGrid.forEach((row, r) => {
        row.forEach((cell, c) => {
          if (cell.isSkull && !cell.isRevealed) {
            unrevealedSkulls.push({ r, c });
          }
        });
      });

      // 4. Reveal remaining skulls one by one
      for (const skull of unrevealedSkulls) {
        setGrid(prev => {
          const newGrid = [...prev];
          newGrid[skull.r] = [...newGrid[skull.r]];
          newGrid[skull.r][skull.c] = { ...newGrid[skull.r][skull.c], isRevealed: true };
          return newGrid;
        });
        playSkullSound();
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } else {
      setGameWon(true);
    }
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  };

  const updateRowName = (idx: number, name: string) => {
    const newNames = [...config.rowNames];
    newNames[idx] = name;
    setConfig({ ...config, rowNames: newNames });
  };

  if (!isInitialized) return <div className="fixed inset-0 bg-black flex items-center justify-center text-red-600 text-4xl font-creepster">LOADING...</div>;

  return (
    <div 
      className={`fixed inset-0 bg-[#020202] flex ${isLandscape ? 'flex-row' : 'flex-col'} items-center justify-center p-0 select-none ${shake ? 'animate-violent-shake' : ''}`} 
      style={{ transformOrigin: `${shakeOrigin.x} ${shakeOrigin.y}` }}
    >
      <div className="vignette" />
      
      {/* Sidebar (Landscape) / Header (Portrait) */}
      <div className={`z-30 flex border-red-900/20 bg-black/60 backdrop-blur-md items-center
        ${isLandscape ? 'flex-col w-[15vw] h-full border-r p-[1vw] justify-between' : 'flex-col h-[20vh] w-full border-b p-[1vh] justify-center gap-[1vh]'}
      `}>
        {/* Title Section (Row 1 in Portrait) */}
        <div className={`flex items-center justify-center ${isLandscape ? 'flex-col w-full pt-[2vh]' : 'w-full pt-0 mb-[1vh]'}`}>
          <h1 
            className="font-nosifer text-red-600 tracking-tighter drop-shadow-[0_0_20px_rgba(255,0,0,0.8)] leading-none flex"
            style={{ 
              flexDirection: isLandscape ? 'column' : 'row',
              fontSize: isLandscape ? '10vh' : '10vw',
              textAlign: 'center'
            }}
          >
            {"해골피하기".split("").map((char, i) => (char === " " ? <span key={i}>&nbsp;</span> : <span key={i} className="leading-none">{char}</span>))}
          </h1>
        </div>

        {/* Controls & Info Section (Row 2 in Portrait / Bottom in Landscape) */}
        <div className={`flex items-center ${isLandscape ? 'flex-col-reverse w-full gap-[2vh] justify-end pb-[2vh]' : 'flex-row w-full justify-between px-[4vw] items-center'}`}>
          
          {/* Buttons Group (Bottom-most in Landscape) */}
          <div className={`flex ${isLandscape ? 'flex-row justify-center w-[90%] gap-[0.8vw]' : 'flex-row gap-[1.5vw]'} ${!isLandscape ? 'order-3' : 'order-1'}`}>
            {[
              { icon: RefreshCw, onClick: initGame, title: '재시작' },
              { icon: Settings, onClick: () => setShowSettings(true), title: '설정' },
              { icon: Maximize2, onClick: toggleFullScreen, title: '전체화면' }
            ].map((btn, i) => (
              <button 
                key={i}
                onClick={btn.onClick} 
                title={btn.title} 
                className="bg-gray-900/80 border-2 border-gray-700 rounded-[1vw] hover:bg-red-900/50 transition-all text-gray-400 hover:text-red-500 shadow-lg flex items-center justify-center aspect-square"
                style={{ 
                  padding: isLandscape ? '0.8vw' : '1vh',
                  width: isLandscape ? '28%' : '8.5vw',
                }}
              >
                <btn.icon size={isLandscape ? windowSize.width * 0.015 : windowSize.height * 0.022} />
              </button>
            ))}
          </div>

          {/* Timer Group (Above Buttons in Landscape) */}
          {config.timerEnabled && !gameOver && !gameWon && (
            <div 
              className={`flex items-center gap-[1vw] bg-black/80 border-2 border-red-900/60 rounded-[2vw] shadow-[0_0_20px_rgba(153,27,27,0.4)] justify-between ${!isLandscape ? 'order-1' : 'order-2'}`}
              style={{ 
                width: isLandscape ? '90%' : '28.5vw',
                height: isLandscape ? 'auto' : '8.5vw',
                padding: isLandscape ? '0.8vh 1.5vw' : '0 2vw'
              }}
            >
              <Timer className={timeLeft <= 3 ? 'text-red-500 animate-ping' : 'text-gray-400'} size={isLandscape ? windowSize.width * 0.015 : windowSize.height * 0.025} />
              <span 
                className={`font-mono font-bold tabular-nums ${timeLeft <= 3 ? 'text-red-500' : 'text-gray-200'}`}
                style={{ fontSize: isLandscape ? '2.5vw' : '4vw' }}
              >
                {timeLeft}
              </span>
              <button onClick={() => setIsPaused(!isPaused)} className="text-gray-400 hover:text-white transition-colors flex items-center justify-center">
                {isPaused ? <Play size={isLandscape ? windowSize.width * 0.012 : windowSize.height * 0.018} /> : <Pause size={isLandscape ? windowSize.width * 0.012 : windowSize.height * 0.018} />}
              </button>
            </div>
          )}

          {/* Current Turn Info (Top-most in this section in Landscape) */}
          {(config.timerEnabled || config.showTurnHighlight) && !gameOver && !gameWon && (
            <div 
              className={`text-red-600 font-horror-kr animate-pulse whitespace-nowrap flex items-center ${!isLandscape ? 'order-2 flex-1 ml-[3vw]' : 'order-3'}`}
              style={{ 
                fontSize: isLandscape ? `${cardSize * 0.55}px` : '8.5vw',
                height: isLandscape ? 'auto' : '8.5vw'
              }}
            >
              {config.rowNames[currentTurnRow]}
            </div>
          )}
        </div>
      </div>

      {/* Game Board */}
      <div className="z-20 flex-1 w-full h-full flex flex-col items-center justify-center overflow-hidden relative">
        <AnimatePresence>
          {showGameOverText && (
            <motion.div 
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-[5%] z-50 flex flex-col items-center gap-2 pointer-events-none"
            >
              <h2 className="text-6xl sm:text-8xl font-nosifer text-red-600 drop-shadow-[0_0_30px_rgba(255,0,0,1)]">GAME OVER</h2>
              <p className="text-4xl sm:text-6xl font-horror-kr text-red-400 [text-shadow:2px_2px_2px_black,-2px_-2px_2px_black,2px_-2px_2px_black,-2px_2px_2px_black]">
                {failedRows.map(r => config.rowNames[r]).join(", ")}에서 해골 발견!
              </p>
            </motion.div>
          )}
          {gameWon && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-[10%] z-50 pointer-events-none"
            >
              <h2 className="text-6xl sm:text-8xl font-nosifer text-green-500 drop-shadow-[0_0_30px_rgba(0,255,0,1)]">VICTORY</h2>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`flex flex-col items-center justify-center transition-all duration-1000 ${gameOver ? 'scale-[0.6]' : 'scale-100'}`}>
          {grid.map((row, r) => (
            <motion.div 
              key={r} 
              className={`flex items-center justify-center transition-all duration-500 ${config.showTurnHighlight && currentTurnRow === r ? 'bg-red-900/10 z-10' : ''}`}
              style={{ height: `${cardSize}px`, gap: `${gapSize}px`, marginBottom: r === grid.length - 1 ? 0 : `${gapSize}px` }}
            >
              {/* Row Name Column - Part of the Card Set Rectangle */}
              <div className="flex items-center justify-center" style={{ width: `${cardSize}px`, height: `${cardSize}px` }}>
                <input 
                  type="text" 
                  data-row-index={r}
                  value={config.rowNames[r] || ''} 
                  onChange={(e) => updateRowName(r, e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const nextIndex = (r + 1) % config.rows;
                      const nextInput = document.querySelector(`input[data-row-index="${nextIndex}"]`) as HTMLInputElement;
                      if (nextInput) {
                        nextInput.focus();
                        nextInput.select();
                      }
                    }
                  }}
                  placeholder="이름"
                  className={`w-full h-full text-center font-horror-kr bg-transparent border-none focus:outline-none focus:text-red-400 transition-colors ${config.showTurnHighlight && currentTurnRow === r ? 'text-red-500' : 'text-gray-500'} cursor-text hover:text-red-300 whitespace-nowrap`}
                  style={{ fontSize: `${cardSize * 0.35}px` }}
                />
              </div>
              {/* Cards Columns */}
              <div className="flex flex-nowrap justify-center" style={{ gap: `${gapSize}px` }}>
                {row.map((cell) => (
                  <div 
                    key={cell.id}
                    onClick={() => handleCellClick(cell.r, cell.c)}
                    style={{
                      width: `${cardSize}px`,
                      height: `${cardSize}px`,
                    }}
                    className={`relative rounded-[10%] flex items-center justify-center transition-all duration-200 border-2 border-gray-800/50
                      ${!cell.isRevealed ? 'maze-bg hover:scale-105 hover:border-red-500 shadow-xl cursor-pointer' : cell.isSkull ? 'revealed-skull cursor-default' : 'revealed-safe cursor-default'}
                      ${(config.timerEnabled || config.showTurnHighlight) && currentTurnRow !== r && !gameOver && !gameWon ? 'pointer-events-none opacity-75' : ''}
                    `}
                  >
                    <AnimatePresence>
                      {!cell.isRevealed ? (
                        <motion.span 
                          key="num" 
                          exit={{ opacity: 0, scale: 0.5 }} 
                          transition={{ duration: 0.15 }}
                          className="font-horror-kr text-gray-600 drop-shadow-sm origin-center"
                          style={{ fontSize: `${cardSize * 0.5}px` }}
                        >
                          {cell.c + 1}
                        </motion.span>
                      ) : cell.isSkull ? (
                        <motion.div 
                          key="skull" 
                          initial={{ scale: 0, rotate: -180 }} 
                          animate={{ scale: 1, rotate: 0 }} 
                          transition={{ duration: 0.2, ease: "easeOut" }} 
                          style={{ originX: 0.5, originY: 0.5 }}
                          className="w-full h-full"
                          onAnimationComplete={() => handleAnimationComplete(cell.r, cell.c)}
                        >
                          <ScarierSkull />
                        </motion.div>
                      ) : (
                        <motion.div 
                          key="x" 
                          initial={{ scale: 0, rotate: -90 }} 
                          animate={{ scale: 1, rotate: 0 }} 
                          transition={{ duration: 0.2, ease: "easeOut" }} 
                          style={{ originX: 0.5, originY: 0.5 }}
                          className="w-full h-full"
                          onAnimationComplete={() => handleAnimationComplete(cell.r, cell.c)}
                        >
                          <ThickX />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {gameOver && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            onClick={initGame}
            className="absolute bottom-[5%] px-16 py-6 bg-red-900 hover:bg-red-700 text-white text-4xl sm:text-5xl font-horror-kr rounded-full border-2 border-red-500 shadow-[0_0_40px_rgba(255,0,0,0.6)] transition-all active:scale-95 cursor-pointer z-50"
          >
            다시 시작하기
          </motion.button>
        )}
      </div>

      {/* Sidebar Settings */}
      <AnimatePresence>
        {showSettings && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed top-0 right-0 h-full w-72 sm:w-96 bg-gray-900/98 z-50 p-6 sm:p-8 sidebar-shadow border-l border-red-900/30 flex flex-col gap-4 sm:gap-6 overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-4xl sm:text-5xl font-nosifer text-red-600">설정</h2>
                <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white"><X size={28} /></button>
              </div>

              <div className="space-y-4 sm:space-y-6 font-horror-kr text-2xl sm:text-3xl">
                <div className="flex flex-col gap-1">
                  <label>줄 개수 ({config.rows})</label>
                  <input type="range" min="1" max="10" value={config.rows} onChange={e => setConfig({...config, rows: parseInt(e.target.value)})} className="accent-red-600" />
                </div>
                <div className="flex flex-col gap-1">
                  <label>칸 개수 ({config.cols})</label>
                  <input type="range" min="3" max="12" value={config.cols} onChange={e => setConfig({...config, cols: parseInt(e.target.value)})} className="accent-red-600" />
                </div>
                <div className="flex flex-col gap-1">
                  <label>해골 개수 ({config.skulls})</label>
                  <input type="range" min="1" max={Math.max(1, config.cols - 1)} value={config.skulls} onChange={e => setConfig({...config, skulls: parseInt(e.target.value)})} className="accent-red-600" />
                </div>
                
                <div className="flex flex-col gap-1">
                  <label>게임 모드</label>
                  <div className="flex gap-2">
                    <button onClick={() => setConfig({...config, gameMode: 'immediate'})} className={`flex-1 py-1 rounded border transition-colors ${config.gameMode === 'immediate' ? 'bg-red-900 border-red-500' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}>바로</button>
                    <button onClick={() => setConfig({...config, gameMode: 'endOfRound'})} className={`flex-1 py-1 rounded border transition-colors ${config.gameMode === 'endOfRound' ? 'bg-red-900 border-red-500' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}>끝까지</button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label>타이머 활성화</label>
                  <input type="checkbox" checked={config.timerEnabled} onChange={e => setConfig({...config, timerEnabled: e.target.checked})} className="w-5 h-5 accent-red-600" />
                </div>

                {config.timerEnabled && (
                  <div className="flex flex-col gap-1">
                    <label>타이머 시간 ({config.timerSeconds}초)</label>
                    <input type="range" min="3" max="60" value={config.timerSeconds} onChange={e => setConfig({...config, timerSeconds: parseInt(e.target.value)})} className="accent-red-600" />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <label>해당 턴 강조</label>
                  <input type="checkbox" checked={config.showTurnHighlight} onChange={e => setConfig({...config, showTurnHighlight: e.target.checked})} className="w-5 h-5 accent-red-600" />
                </div>

                <button onClick={initGame} className="w-full py-3 sm:py-4 bg-red-800 hover:bg-red-700 text-white rounded-xl mt-2 font-bold shadow-lg transition-all text-3xl">
                  설정 저장 및 재시작
                </button>
                <p className="text-center text-gray-500 text-2xl mt-4 opacity-60 font-horror-kr">
                  Made by KMC, 260330
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
