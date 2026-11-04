// ============================================================================
// XOTrix - Premium Tic-Tac-Toe Game
// ============================================================================

// === GAME STATE ===
const GameState = {
    board: Array(9).fill(null),
    currentPlayer: 'X',
    gameMode: 'human-vs-human',
    difficulty: 'advanced',
    isGameOver: false,
    winner: null,
    winningLine: null,
    moveHistory: [],
    startTime: null,
    elapsedTime: 0,
    timerInterval: null,
    botFirst: false,
    player1Score: 0,
    player2Score: 0,
    soundEnabled: true,
    volume: 0.7,
    vibrateEnabled: true,
    currentTheme: 'neon',
    replayIndex: -1
};

// === STATS & ACHIEVEMENTS ===
const Stats = {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    fastestWin: null,
    currentStreak: 0,
    bestStreak: 0,
    eloRating: 1200,
    achievements: {}
};

const ACHIEVEMENTS = {
    firstWin: { name: 'First Win', desc: 'Win your first game', icon: '🥇', unlocked: false },
    beatMaster: { name: 'AI Slayer', desc: 'Beat Master AI', icon: '🤖', unlocked: false },
    winStreak10: { name: 'Unstoppable', desc: '10-game win streak', icon: '🔥', unlocked: false },
    fastWin: { name: 'Speed Demon', desc: 'Win in under 30 seconds', icon: '⚡', unlocked: false },
    perfectDefense: { name: 'Perfect Defense', desc: 'Force 10 draws in a row', icon: '🎓', unlocked: false },
    hundredGames: { name: 'Veteran', desc: 'Play 100 games', icon: '🏆', unlocked: false },
    undefeated20: { name: 'Legendary', desc: '20-0 record', icon: '👑', unlocked: false },
    tournamentChamp: { name: 'Champion', desc: 'Win a tournament', icon: '🏅', unlocked: false }
};

// === OPENING BOOK ===
const OPENING_BOOK = {
    // Center first - optimal responses
    '4': [0, 2, 6, 8],  // Corners are best response to center
    // Corner first - counter strategies
    '0': [4, 8],  // Center or opposite corner
    '2': [4, 6],
    '6': [4, 2],
    '8': [4, 0],
    // Edge first - exploit weakness
    '1': [4],
    '3': [4],
    '5': [4],
    '7': [4]
};

// === AUDIO SYSTEM ===
const AudioEngine = {
    context: null,
    
    init() {
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    },
    
    playTone(frequency, duration, type = 'sine') {
        if (!GameState.soundEnabled || !this.context) return;
        
        const oscillator = this.context.createOscillator();
        const gainNode = this.context.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.context.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(GameState.volume, this.context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);
        
        oscillator.start(this.context.currentTime);
        oscillator.stop(this.context.currentTime + duration);
    },
    
    playMove() {
        this.playTone(440, 0.1, 'square');
    },
    
    playWin() {
        setTimeout(() => this.playTone(523.25, 0.2), 0);
        setTimeout(() => this.playTone(659.25, 0.2), 200);
        setTimeout(() => this.playTone(783.99, 0.3), 400);
    },
    
    playDraw() {
        this.playTone(220, 0.5, 'sawtooth');
    },
    
    playBotThinking() {
        this.playTone(330, 0.1, 'sine');
    }
};

// === AI ENGINE ===
const AI = {
    // Minimax with Alpha-Beta Pruning
    minimax(board, depth, alpha, beta, isMaximizing, player) {
        const winner = this.checkWinner(board);
        
        if (winner === player) return 1000 - depth;
        if (winner === (player === 'X' ? 'O' : 'X')) return depth - 1000;
        if (this.isBoardFull(board)) return 0;
        if (depth === 0) return this.evaluateBoard(board, player);
        
        const emptyCells = board.map((cell, i) => cell === null ? i : null).filter(i => i !== null);
        
        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const index of emptyCells) {
                board[index] = player;
                const eval = this.minimax(board, depth - 1, alpha, beta, false, player);
                board[index] = null;
                maxEval = Math.max(maxEval, eval);
                alpha = Math.max(alpha, eval);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            const opponent = player === 'X' ? 'O' : 'X';
            for (const index of emptyCells) {
                board[index] = opponent;
                const eval = this.minimax(board, depth - 1, alpha, beta, true, player);
                board[index] = null;
                minEval = Math.min(minEval, eval);
                beta = Math.min(beta, eval);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    },
    
    evaluateBoard(board, player) {
        const opponent = player === 'X' ? 'O' : 'X';
        let score = 0;
        
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];
        
        for (const line of lines) {
            const [a, b, c] = line;
            const cells = [board[a], board[b], board[c]];
            const playerCount = cells.filter(c => c === player).length;
            const opponentCount = cells.filter(c => c === opponent).length;
            const emptyCount = cells.filter(c => c === null).length;
            
            if (playerCount === 2 && emptyCount === 1) score += 10;
            if (opponentCount === 2 && emptyCount === 1) score -= 10;
        }
        
        // Position bonuses
        if (board[4] === player) score += 3;
        const corners = [0, 2, 6, 8];
        corners.forEach(i => {
            if (board[i] === player) score += 2;
        });
        
        return score;
    },
    
    getBestMove(board, difficulty, player) {
        const emptyCells = board.map((cell, i) => cell === null ? i : null).filter(i => i !== null);
        
        if (emptyCells.length === 0) return null;
        
        // Opening book for Master difficulty
        if (difficulty === 'master' && emptyCells.length >= 8) {
            const moveCount = 9 - emptyCells.length;
            if (moveCount === 0 && OPENING_BOOK['4']) {
                return 4; // Always start center
            }
            if (moveCount === 1) {
                const firstMove = board.findIndex(c => c !== null);
                const responses = OPENING_BOOK[firstMove.toString()];
                if (responses) {
                    return responses[0];
                }
            }
        }
        
        // Difficulty-based strategy
        switch (difficulty) {
            case 'beginner':
                // 50% random, 50% minimax depth 2
                if (Math.random() < 0.5) {
                    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
                }
                return this.minimaxMove(board, 2, player);
                
            case 'intermediate':
                return this.minimaxMove(board, 4, player);
                
            case 'advanced':
                return this.minimaxMove(board, 6, player);
                
            case 'master':
                return this.minimaxMove(board, 9, player);
                
            default:
                return this.minimaxMove(board, 6, player);
        }
    },
    
    minimaxMove(board, maxDepth, player) {
        const emptyCells = board.map((cell, i) => cell === null ? i : null).filter(i => i !== null);
        let bestMove = emptyCells[0];
        let bestValue = -Infinity;
        
        for (const index of emptyCells) {
            board[index] = player;
            const moveValue = this.minimax(board, maxDepth, -Infinity, Infinity, false, player);
            board[index] = null;
            
            if (moveValue > bestValue) {
                bestValue = moveValue;
                bestMove = index;
            }
        }
        
        return bestMove;
    },
    
    checkWinner(board) {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];
        
        for (const line of lines) {
            const [a, b, c] = line;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return board[a];
            }
        }
        
        return null;
    },
    
    isBoardFull(board) {
        return board.every(cell => cell !== null);
    }
};

// === GAME LOGIC ===
const Game = {
    init() {
        this.loadStats();
        this.setupEventListeners();
        this.updateUI();
        AudioEngine.init();
        this.applyTheme(GameState.currentTheme);
        this.checkUrlReplay();
    },

    checkUrlReplay() {
        const urlParams = new URLSearchParams(window.location.search);
        const replay = urlParams.get('replay');
        if (replay) {
            setTimeout(() => this.loadReplay(replay), 500);
        }
    },

    loadReplay(replayStr) {
        this.resetGame();
        const moves = replayStr.split('').map(Number);
        moves.forEach((moveIndex) => {
            if (!isNaN(moveIndex) && moveIndex >= 0 && moveIndex <= 8 && GameState.board[moveIndex] === null) {
                GameState.board[moveIndex] = GameState.currentPlayer;
                GameState.moveHistory.push({
                    index: moveIndex,
                    player: GameState.currentPlayer,
                    timestamp: Date.now()
                });
                GameState.currentPlayer = GameState.currentPlayer === 'X' ? 'O' : 'X';
            }
        });
        this.checkGameOver();
        this.updateUI();
        this.showToast('Replay loaded!', 'success');
    },
    
    setupEventListeners() {
        // Board cells
        document.querySelectorAll('.cell').forEach(cell => {
            cell.addEventListener('click', (e) => this.handleCellClick(e));
        });
        
        // Mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.changeMode(e.target.closest('.mode-btn').dataset.mode));
        });
        
        // Difficulty buttons
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.changeDifficulty(e.target.closest('.difficulty-btn').dataset.difficulty));
        });
        
        // Control buttons
        document.getElementById('undoBtn').addEventListener('click', () => this.undoMove());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetGame());
        document.getElementById('historyBtn').addEventListener('click', () => this.toggleHistory());
        document.getElementById('shareBtn').addEventListener('click', () => this.shareGame());
        
        // Settings
        document.getElementById('soundToggle').addEventListener('change', (e) => {
            GameState.soundEnabled = e.target.checked;
            this.saveStats();
        });
        
        document.getElementById('volumeSlider').addEventListener('input', (e) => {
            GameState.volume = e.target.value / 100;
            this.saveStats();
        });
        
        document.getElementById('vibrateToggle').addEventListener('change', (e) => {
            GameState.vibrateEnabled = e.target.checked;
            this.saveStats();
        });
        
        document.getElementById('botFirstToggle').addEventListener('change', (e) => {
            GameState.botFirst = e.target.checked;
            this.resetGame();
        });
        
        // Theme buttons
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const theme = e.target.dataset.theme;
                this.applyTheme(theme);
            });
        });
        
        // Victory modal
        document.getElementById('newGameBtn').addEventListener('click', () => {
            this.closeModal('victoryModal');
            this.resetGame();
        });
        
        document.getElementById('closeVictoryModal').addEventListener('click', () => {
            this.closeModal('victoryModal');
        });
        
        document.getElementById('viewStatsBtn').addEventListener('click', () => {
            this.closeModal('victoryModal');
            this.showToast('Stats panel updated!', 'info');
        });
        
        document.getElementById('shareResultBtn').addEventListener('click', () => {
            this.shareGame();
        });
        
        // Mobile menu toggle
        document.getElementById('menuToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });
        
        // Replay controls
        document.getElementById('replayPrev').addEventListener('click', () => this.replayPrevious());
        document.getElementById('replayNext').addEventListener('click', () => this.replayNext());
        document.getElementById('replaySlider').addEventListener('input', (e) => {
            this.replayToIndex(parseInt(e.target.value));
        });
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    },
    
    handleCellClick(e) {
        const cell = e.target;
        const index = parseInt(cell.dataset.index);
        
        if (GameState.isGameOver || GameState.board[index] !== null) return;
        
        // In replay mode, exit replay first
        if (GameState.replayIndex !== -1) {
            GameState.replayIndex = -1;
            this.updateBoard();
        }
        
        // Human vs Bot - only allow human moves
        if (GameState.gameMode === 'human-vs-bot') {
            const humanPlayer = GameState.botFirst ? 'O' : 'X';
            if (GameState.currentPlayer !== humanPlayer) return;
        }
        
        // Bot vs Bot - don't allow human interaction
        if (GameState.gameMode === 'bot-vs-bot') return;
        
        this.makeMove(index);
    },
    
    makeMove(index) {
        if (GameState.board[index] !== null) return;
        
        // Record move
        GameState.board[index] = GameState.currentPlayer;
        GameState.moveHistory.push({
            index,
            player: GameState.currentPlayer,
            timestamp: Date.now()
        });
        
        // Update UI
        this.updateBoard();
        AudioEngine.playMove();
        this.vibrate(50);
        
        // Check win/draw
        if (this.checkGameOver()) {
            this.handleGameOver();
            return;
        }
        
        // Switch player
        GameState.currentPlayer = GameState.currentPlayer === 'X' ? 'O' : 'X';
        this.updateTurnIndicator();
        
        // Bot move if needed
        if (GameState.gameMode === 'human-vs-bot') {
            const botPlayer = GameState.botFirst ? 'X' : 'O';
            if (GameState.currentPlayer === botPlayer) {
                this.executeBotMove();
            }
        } else if (GameState.gameMode === 'bot-vs-bot') {
            setTimeout(() => this.executeBotMove(), 800);
        }
    },
    
    async executeBotMove() {
        this.showBotThinking(true);
        AudioEngine.playBotThinking();
        
        // Simulate thinking time based on difficulty
        const thinkTime = {
            beginner: 300,
            intermediate: 600,
            advanced: 1000,
            master: 1500
        }[GameState.difficulty] || 800;
        
        await new Promise(resolve => setTimeout(resolve, thinkTime));
        
        const boardCopy = [...GameState.board];
        const move = AI.getBestMove(boardCopy, GameState.difficulty, GameState.currentPlayer);
        
        this.showBotThinking(false);
        
        if (move !== null) {
            this.makeMove(move);
        }
    },
    
    checkGameOver() {
        const winner = this.checkWinner();
        if (winner) {
            GameState.winner = winner;
            GameState.isGameOver = true;
            return true;
        }
        
        if (GameState.board.every(cell => cell !== null)) {
            GameState.isGameOver = true;
            return true;
        }
        
        return false;
    },
    
    checkWinner() {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];
        
        for (const line of lines) {
            const [a, b, c] = line;
            if (GameState.board[a] && 
                GameState.board[a] === GameState.board[b] && 
                GameState.board[a] === GameState.board[c]) {
                GameState.winningLine = line;
                return GameState.board[a];
            }
        }
        
        return null;
    },
    
    handleGameOver() {
        clearInterval(GameState.timerInterval);
        
        if (GameState.winner) {
            this.drawWinningLine();
            AudioEngine.playWin();
            this.vibrate([100, 50, 100, 50, 200]);
            this.triggerConfetti();
            
            // Update scores
            if (GameState.winner === 'X') {
                GameState.player1Score++;
            } else {
                GameState.player2Score++;
            }
            
            // Update stats
            if (GameState.gameMode === 'human-vs-bot') {
                const humanPlayer = GameState.botFirst ? 'O' : 'X';
                const result = GameState.winner === humanPlayer ? 'win' : 'loss';
                this.updateStats(result, GameState.elapsedTime);
            } else {
                Stats.gamesPlayed++;
                this.saveStats();
                this.updateStatsDisplay();
            }
            
            setTimeout(() => {
                this.showVictoryModal();
            }, 1000);
        } else {
            AudioEngine.playDraw();
            this.updateStats('draw');
            setTimeout(() => {
                this.showToast('Draw! Well played!', 'info');
            }, 500);
        }
        
        this.updateUI();
        this.saveStats();
    },
    
    drawWinningLine() {
        if (!GameState.winningLine) return;
        
        const cells = document.querySelectorAll('.cell');
        const line = document.getElementById('winningLine').querySelector('line');
        const svg = document.getElementById('winningLine');
        
        GameState.winningLine.forEach(index => {
            cells[index].classList.add('winning');
        });
        
        const firstCell = cells[GameState.winningLine[0]];
        const lastCell = cells[GameState.winningLine[2]];
        
        const firstRect = firstCell.getBoundingClientRect();
        const lastRect = lastCell.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        
        const x1 = firstRect.left + firstRect.width / 2 - svgRect.left;
        const y1 = firstRect.top + firstRect.height / 2 - svgRect.top;
        const x2 = lastRect.left + lastRect.width / 2 - svgRect.left;
        const y2 = lastRect.top + lastRect.height / 2 - svgRect.top;
        
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        
        svg.classList.add('show');
    },
    
    triggerConfetti() {
        if (typeof confetti !== 'undefined') {
            const colors = GameState.winner === 'X' ? ['#ff6b6b', '#ff8e8e'] : ['#4ecdc4', '#44a08d'];
            
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: colors
            });
            
            setTimeout(() => {
                confetti({
                    particleCount: 50,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: colors
                });
            }, 250);
            
            setTimeout(() => {
                confetti({
                    particleCount: 50,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: colors
                });
            }, 400);
        }
    },
    
    showVictoryModal() {
        document.getElementById('victoryTitle').textContent = `🎉 ${GameState.winner} WINS!`;
        
        const subtitles = [
            'Perfect strategy!',
            'Brilliant move!',
            'Outstanding victory!',
            'Masterful play!',
            'Exceptional win!'
        ];
        document.getElementById('victorySubtitle').textContent = 
            subtitles[Math.floor(Math.random() * subtitles.length)];
        
        const minutes = Math.floor(GameState.elapsedTime / 60);
        const seconds = GameState.elapsedTime % 60;
        document.getElementById('victoryTime').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        document.getElementById('victoryMoves').textContent = GameState.moveHistory.length;
        
        const eloChange = this.calculateEloChange();
        document.getElementById('victoryElo').textContent = 
            (eloChange >= 0 ? '+' : '') + eloChange;
        
        this.showModal('victoryModal');
    },
    
    undoMove() {
        if (GameState.moveHistory.length === 0 || GameState.isGameOver) return;
        
        // Exit replay mode if active
        if (GameState.replayIndex !== -1) {
            GameState.replayIndex = -1;
        }
        
        const lastMove = GameState.moveHistory.pop();
        GameState.board[lastMove.index] = null;
        GameState.currentPlayer = lastMove.player;
        
        this.updateBoard();
        this.updateTurnIndicator();
        AudioEngine.playMove();
    },
    
    resetGame() {
        clearInterval(GameState.timerInterval);
        
        GameState.board = Array(9).fill(null);
        GameState.currentPlayer = 'X';
        GameState.isGameOver = false;
        GameState.winner = null;
        GameState.winningLine = null;
        GameState.moveHistory = [];
        GameState.elapsedTime = 0;
        GameState.replayIndex = -1;
        
        document.getElementById('winningLine').classList.remove('show');
        
        this.updateBoard();
        this.updateTurnIndicator();
        this.startTimer();
        
        // If bot plays first
        if (GameState.gameMode === 'human-vs-bot' && GameState.botFirst) {
            setTimeout(() => this.executeBotMove(), 500);
        } else if (GameState.gameMode === 'bot-vs-bot') {
            setTimeout(() => this.executeBotMove(), 500);
        }
    },
    
    changeMode(mode) {
        GameState.gameMode = mode;
        
        // Update active button
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = document.querySelector(`[data-mode="${mode}"]`);
        if (activeBtn) activeBtn.classList.add('active');
        
        // Show/hide difficulty section
        const diffSection = document.getElementById('botDifficultySection');
        if (mode === 'human-vs-bot' || mode === 'bot-vs-bot') {
            diffSection.style.display = 'block';
        } else {
            diffSection.style.display = 'none';
        }
        
        // Update player names
        if (mode === 'human-vs-bot') {
            document.getElementById('player1Name').textContent = GameState.botFirst ? 'Bot' : 'You';
            document.getElementById('player2Name').textContent = GameState.botFirst ? 'You' : 'Bot';
        } else if (mode === 'bot-vs-bot') {
            document.getElementById('player1Name').textContent = 'Bot X';
            document.getElementById('player2Name').textContent = 'Bot O';
        } else {
            document.getElementById('player1Name').textContent = 'Player 1';
            document.getElementById('player2Name').textContent = 'Player 2';
        }
        
        this.resetGame();
    },
    
    changeDifficulty(difficulty) {
        GameState.difficulty = difficulty;
        
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-difficulty="${difficulty}"]`).classList.add('active');
        
        this.resetGame();
    },
    
    updateBoard() {
        const cells = document.querySelectorAll('.cell');
        
        // Determine which board state to show (current or replay)
        const displayBoard = GameState.replayIndex === -1 
            ? GameState.board 
            : this.getReplayBoard(GameState.replayIndex);
        
        cells.forEach((cell, index) => {
            cell.textContent = displayBoard[index] || '';
            cell.className = 'cell';
            if (displayBoard[index]) {
                cell.classList.add(displayBoard[index].toLowerCase());
            }
        });
    },
    
    getReplayBoard(moveIndex) {
        const board = Array(9).fill(null);
        for (let i = 0; i <= moveIndex && i < GameState.moveHistory.length; i++) {
            const move = GameState.moveHistory[i];
            board[move.index] = move.player;
        }
        return board;
    },
    
    updateTurnIndicator() {
        const indicator = document.getElementById('turnIndicator');
        const turnText = indicator.querySelector('.turn-text');
        const turnSymbol = indicator.querySelector('.turn-symbol');
        
        if (GameState.isGameOver) {
            turnText.textContent = GameState.winner ? `${GameState.winner} Wins!` : 'Draw!';
            turnSymbol.textContent = '';
        } else {
            turnText.textContent = `${GameState.currentPlayer}'s Turn`;
            turnSymbol.textContent = GameState.currentPlayer;
        }
        
        // Update active player avatar
        document.querySelectorAll('.player-avatar').forEach(avatar => {
            avatar.classList.remove('active');
        });
        
        if (!GameState.isGameOver) {
            if (GameState.currentPlayer === 'X') {
                document.querySelector('#player1Info .player-avatar').classList.add('active');
            } else {
                document.querySelector('#player2Info .player-avatar').classList.add('active');
            }
        }
    },
    
    startTimer() {
        GameState.startTime = Date.now();
        GameState.elapsedTime = 0;
        
        GameState.timerInterval = setInterval(() => {
            GameState.elapsedTime = Math.floor((Date.now() - GameState.startTime) / 1000);
            this.updateTimerDisplay();
        }, 1000);
    },
    
    updateTimerDisplay() {
        const timer = document.getElementById('gameTimer');
        const minutes = Math.floor(GameState.elapsedTime / 60);
        const seconds = GameState.elapsedTime % 60;
        timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Challenge mode - timer warnings
        if (GameState.gameMode === 'challenge') {
            if (GameState.elapsedTime >= 50) {
                timer.classList.add('critical');
            } else if (GameState.elapsedTime >= 40) {
                timer.classList.add('warning');
            }
        }
    },
    
    updateStats(result, time = null) {
        Stats.gamesPlayed++;
        
        if (result === 'win') {
            Stats.wins++;
            Stats.currentStreak++;
            Stats.bestStreak = Math.max(Stats.bestStreak, Stats.currentStreak);
            
            if (time && (!Stats.fastestWin || time < Stats.fastestWin)) {
                Stats.fastestWin = time;
                if (time < 30) {
                    this.unlockAchievement('fastWin');
                }
            }
            
            if (Stats.wins === 1) {
                this.unlockAchievement('firstWin');
            }
            
            if (Stats.currentStreak >= 10) {
                this.unlockAchievement('winStreak10');
            }
            
            if (GameState.difficulty === 'master') {
                this.unlockAchievement('beatMaster');
            }
        } else if (result === 'loss') {
            Stats.losses++;
            Stats.currentStreak = 0;
        } else {
            Stats.draws++;
        }
        
        if (Stats.gamesPlayed >= 100) {
            this.unlockAchievement('hundredGames');
        }
        
        if (Stats.wins === 20 && Stats.losses === 0) {
            this.unlockAchievement('undefeated20');
        }
        
        this.saveStats();
        this.updateStatsDisplay();
    },
    
    calculateEloChange() {
        const K = 32;
        const opponentElo = {
            beginner: 800,
            intermediate: 1200,
            advanced: 1600,
            master: 2000
        }[GameState.difficulty] || 1200;
        
        const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - Stats.eloRating) / 400));
        
        const humanPlayer = GameState.botFirst ? 'O' : 'X';
        const actualScore = GameState.winner === humanPlayer ? 1 : 0;
        
        const change = Math.round(K * (actualScore - expectedScore));
        Stats.eloRating += change;
        
        return change;
    },
    
    unlockAchievement(id) {
        if (ACHIEVEMENTS[id] && !ACHIEVEMENTS[id].unlocked) {
            ACHIEVEMENTS[id].unlocked = true;
            this.showToast(`🏅 Achievement Unlocked: ${ACHIEVEMENTS[id].name}!`, 'success');
            this.vibrate(200);
        }
    },
    
    updateStatsDisplay() {
        const winRate = Stats.gamesPlayed > 0 
            ? Math.round((Stats.wins / Stats.gamesPlayed) * 100) 
            : 0;
        
        document.getElementById('winRate').textContent = `${winRate}%`;
        document.getElementById('gamesPlayed').textContent = Stats.gamesPlayed;
        document.getElementById('eloRating').textContent = Stats.eloRating;
        document.getElementById('currentStreak').textContent = Stats.currentStreak;
        
        if (Stats.fastestWin) {
            const minutes = Math.floor(Stats.fastestWin / 60);
            const seconds = Stats.fastestWin % 60;
            document.getElementById('fastestWin').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    },
    
    updateUI() {
        this.updateBoard();
        this.updateTurnIndicator();
        this.updateStatsDisplay();
        
        document.getElementById('player1Score').textContent = GameState.player1Score;
        document.getElementById('player2Score').textContent = GameState.player2Score;
        document.getElementById('moveCounter').textContent = `Move: ${GameState.moveHistory.length}`;
    },
    
    toggleHistory() {
        const history = document.getElementById('moveHistory');
        history.classList.toggle('show');
        
        if (history.classList.contains('show')) {
            this.updateHistoryDisplay();
        }
    },
    
    updateHistoryDisplay() {
        const list = document.getElementById('historyList');
        list.innerHTML = '';
        
        GameState.moveHistory.forEach((move, index) => {
            const item = document.createElement('div');
            item.className = 'history-item';
            if (index === GameState.replayIndex) {
                item.classList.add('current');
            }
            item.textContent = `${index + 1}. ${move.player} → Cell ${move.index + 1}`;
            list.appendChild(item);
        });
        
        const slider = document.getElementById('replaySlider');
        slider.max = GameState.moveHistory.length - 1;
        slider.value = GameState.replayIndex === -1 ? slider.max : GameState.replayIndex;
    },
    
    replayPrevious() {
        if (GameState.moveHistory.length === 0) return;
        
        if (GameState.replayIndex === -1) {
            GameState.replayIndex = GameState.moveHistory.length - 2;
        } else if (GameState.replayIndex > 0) {
            GameState.replayIndex--;
        }
        
        this.updateBoard();
        this.updateHistoryDisplay();
    },
    
    replayNext() {
        if (GameState.moveHistory.length === 0) return;
        
        if (GameState.replayIndex === -1) return;
        
        GameState.replayIndex++;
        if (GameState.replayIndex >= GameState.moveHistory.length) {
            GameState.replayIndex = -1;
        }
        
        this.updateBoard();
        this.updateHistoryDisplay();
    },
    
    replayToIndex(index) {
        if (GameState.moveHistory.length === 0) return;
        
        GameState.replayIndex = index;
        this.updateBoard();
        this.updateHistoryDisplay();
    },
    
    shareGame() {
        const moveSeq = GameState.moveHistory.map(m => m.index).join('');
        const url = `${window.location.origin}${window.location.pathname}?replay=${moveSeq}`;
        
        if (navigator.share) {
            navigator.share({
                title: 'XOTrix Game',
                text: `Check out my XOTrix game! ${GameState.winner ? GameState.winner + ' won!' : 'It was a draw!'}`,
                url: url
            });
        } else {
            navigator.clipboard.writeText(url);
            this.showToast('Game URL copied to clipboard!', 'success');
        }
    },
    
    applyTheme(theme) {
        GameState.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-theme="${theme}"]`).classList.add('active');
        
        this.saveStats();
    },
    
    showBotThinking(show) {
        const indicator = document.getElementById('botThinking');
        if (show) {
            indicator.classList.add('show');
        } else {
            indicator.classList.remove('show');
        }
    },
    
    showModal(id) {
        document.getElementById(id).classList.add('show');
    },
    
    closeModal(id) {
        document.getElementById(id).classList.remove('show');
    },
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️'
        };
        
        toast.innerHTML = `
            <span class="toast-icon">${icons[type]}</span>
            <span class="toast-message">${message}</span>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },
    
    vibrate(pattern) {
        if (GameState.vibrateEnabled && 'vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    },
    
    handleKeyboard(e) {
        if (GameState.isGameOver) return;
        
        // Arrow keys for cell navigation
        const currentIndex = GameState.board.findIndex((cell, i) => 
            document.querySelector(`[data-index="${i}"]`).matches(':focus')
        );
        
        let newIndex = -1;
        
        if (e.key === 'ArrowUp' && currentIndex >= 3) newIndex = currentIndex - 3;
        if (e.key === 'ArrowDown' && currentIndex < 6) newIndex = currentIndex + 3;
        if (e.key === 'ArrowLeft' && currentIndex % 3 !== 0) newIndex = currentIndex - 1;
        if (e.key === 'ArrowRight' && currentIndex % 3 !== 2) newIndex = currentIndex + 1;
        
        if (newIndex >= 0 && newIndex < 9) {
            document.querySelector(`[data-index="${newIndex}"]`).focus();
        }
        
        // Enter/Space to place mark
        if ((e.key === 'Enter' || e.key === ' ') && currentIndex >= 0) {
            e.preventDefault();
            this.handleCellClick({ target: document.querySelector(`[data-index="${currentIndex}"]`) });
        }
        
        // Number keys 1-9 for direct cell selection
        if (e.key >= '1' && e.key <= '9') {
            const index = parseInt(e.key) - 1;
            if (GameState.board[index] === null) {
                this.makeMove(index);
            }
        }
        
        // U for undo
        if (e.key === 'u' || e.key === 'U') {
            this.undoMove();
        }
        
        // R for reset
        if (e.key === 'r' || e.key === 'R') {
            this.resetGame();
        }
    },
    
    saveStats() {
        const data = {
            stats: Stats,
            achievements: ACHIEVEMENTS,
            gameState: {
                soundEnabled: GameState.soundEnabled,
                volume: GameState.volume,
                vibrateEnabled: GameState.vibrateEnabled,
                currentTheme: GameState.currentTheme,
                player1Score: GameState.player1Score,
                player2Score: GameState.player2Score
            }
        };
        localStorage.setItem('xotrix-data', JSON.stringify(data));
    },
    
    loadStats() {
        try {
            const data = JSON.parse(localStorage.getItem('xotrix-data'));
            if (data) {
                Object.assign(Stats, data.stats);
                Object.assign(ACHIEVEMENTS, data.achievements);
                if (data.gameState) {
                    GameState.soundEnabled = data.gameState.soundEnabled ?? true;
                    GameState.volume = data.gameState.volume ?? 0.7;
                    GameState.vibrateEnabled = data.gameState.vibrateEnabled ?? true;
                    GameState.currentTheme = data.gameState.currentTheme || 'neon';
                    GameState.player1Score = data.gameState.player1Score || 0;
                    GameState.player2Score = data.gameState.player2Score || 0;
                    
                    // Update UI elements
                    document.getElementById('soundToggle').checked = GameState.soundEnabled;
                    document.getElementById('volumeSlider').value = GameState.volume * 100;
                    document.getElementById('vibrateToggle').checked = GameState.vibrateEnabled;
                }
            }
        } catch (e) {
            console.error('Failed to load stats:', e);
        }
    }
};

// === INITIALIZE ===
document.addEventListener('DOMContentLoaded', () => {
    Game.init();
    Game.resetGame();
});