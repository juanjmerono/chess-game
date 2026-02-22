/**
 * Chess App — Mode switching, game orchestration, UI wiring
 */
const ChessApp = (() => {

    let currentMode = null; // 'game' | 'practice'
    let gameState = null;
    let playerColor = 'w';
    let currentPuzzleIndex = 0;
    let puzzleMoveIndex = 0;
    let puzzleState = null;
    let botThinking = false;

    function init() {
        // Wire up mode buttons
        document.getElementById('btn-game-mode').addEventListener('click', () => showColorSelect());
        document.getElementById('btn-practice-mode').addEventListener('click', () => startPracticeMode());
        document.getElementById('btn-back-menu').addEventListener('click', () => showMainMenu());
        document.getElementById('btn-back-menu-practice').addEventListener('click', () => showMainMenu());
        document.getElementById('btn-new-game').addEventListener('click', () => showColorSelect());
        document.getElementById('btn-play-white').addEventListener('click', () => startGameMode('w'));
        document.getElementById('btn-play-black').addEventListener('click', () => startGameMode('b'));
        document.getElementById('btn-prev-puzzle').addEventListener('click', () => navigatePuzzle(-1));
        document.getElementById('btn-next-puzzle').addEventListener('click', () => navigatePuzzle(1));
        document.getElementById('btn-retry-puzzle').addEventListener('click', () => loadPuzzle(currentPuzzleIndex));

        showMainMenu();
    }

    // ───────── Navigation ─────────

    function showMainMenu() {
        currentMode = null;
        document.getElementById('main-menu').classList.remove('hidden');
        document.getElementById('game-screen').classList.add('hidden');
        document.getElementById('practice-screen').classList.add('hidden');
        document.getElementById('color-select').classList.add('hidden');
    }

    function showColorSelect() {
        document.getElementById('main-menu').classList.remove('hidden');
        document.getElementById('color-select').classList.remove('hidden');
        document.getElementById('game-screen').classList.add('hidden');
        document.getElementById('practice-screen').classList.add('hidden');
    }

    // ───────── Game Mode ─────────

    function startGameMode(color) {
        currentMode = 'game';
        playerColor = color;
        gameState = ChessEngine.createInitialState();

        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('color-select').classList.add('hidden');
        document.getElementById('game-screen').classList.remove('hidden');
        document.getElementById('practice-screen').classList.add('hidden');

        // Clear UI
        document.getElementById('game-status').textContent = '';
        document.getElementById('game-result-overlay').classList.add('hidden');

        ChessBoard.init('#game-board', {
            flipped: playerColor === 'b',
            onMove: handlePlayerMove,
            interactive: true
        });

        renderGameUI();

        // If player chose black, bot plays first
        if (playerColor === 'b') {
            ChessBoard.setInteractive(false);
            ChessBoard.render(gameState);
            setTimeout(() => botMove(), 400);
        }
    }

    function handlePlayerMove(move) {
        if (botThinking || gameState.gameOver) return;
        if (gameState.turn !== playerColor) return;

        const newState = ChessEngine.makeMove(gameState, move);
        if (!newState) return;

        gameState = newState;
        ChessBoard.setLastMove(move);

        if (gameState.gameOver) {
            renderGameUI();
            showGameResult();
            return;
        }

        // Bot's turn
        botThinking = true;
        ChessBoard.setInteractive(false);
        renderGameUI();
        updateStatus('El bot está pensando...');

        setTimeout(() => botMove(), 300);
    }

    function botMove() {
        const move = ChessBot.getBestMove(gameState, 3);
        if (!move) {
            botThinking = false;
            return;
        }

        const newState = ChessEngine.makeMove(gameState, move);
        if (!newState) {
            botThinking = false;
            return;
        }

        gameState = newState;
        ChessBoard.setLastMove(move);
        botThinking = false;
        ChessBoard.setInteractive(true);

        renderGameUI();

        if (gameState.gameOver) {
            showGameResult();
            return;
        }

        updateStatus('Tu turno');
    }

    function renderGameUI() {
        ChessBoard.render(gameState);
        ChessBoard.renderCaptured(gameState, '#game-captured');
        ChessBoard.renderMoveHistory(gameState, '#game-moves');

        if (!gameState.gameOver && !botThinking) {
            if (gameState.turn === playerColor) {
                updateStatus('Tu turno');
            } else {
                updateStatus('El bot está pensando...');
            }
        }
    }

    function updateStatus(text) {
        document.getElementById('game-status').textContent = text;
    }

    function showGameResult() {
        const overlay = document.getElementById('game-result-overlay');
        const resultText = document.getElementById('game-result-text');

        let msg = '';
        if (gameState.result === '1/2-1/2') {
            msg = '¡Tablas!';
        } else {
            const whiteWins = gameState.result === '1-0';
            if ((whiteWins && playerColor === 'w') || (!whiteWins && playerColor === 'b')) {
                msg = '🎉 ¡Has ganado!';
            } else {
                msg = '😔 Has perdido';
            }
        }

        resultText.textContent = msg;
        overlay.classList.remove('hidden');
        ChessBoard.setInteractive(false);
    }

    // ───────── Practice Mode ─────────

    function startPracticeMode() {
        currentMode = 'practice';
        currentPuzzleIndex = 0;

        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('color-select').classList.add('hidden');
        document.getElementById('game-screen').classList.add('hidden');
        document.getElementById('practice-screen').classList.remove('hidden');

        loadPuzzle(0);
    }

    function loadPuzzle(index) {
        const puzzles = ChessPuzzles.getAll();
        if (index < 0 || index >= puzzles.length) return;

        currentPuzzleIndex = index;
        puzzleMoveIndex = 0;
        const puzzle = puzzles[index];

        puzzleState = ChessEngine.stateFromFEN(puzzle.fen);

        // Update info
        document.getElementById('puzzle-title').textContent = `Puzzle ${puzzle.id}: ${puzzle.title}`;
        document.getElementById('puzzle-description').textContent = puzzle.description;
        document.getElementById('puzzle-counter').textContent = `${index + 1} / ${puzzles.length}`;
        document.getElementById('puzzle-feedback').textContent = '';
        document.getElementById('puzzle-feedback').className = 'puzzle-feedback';

        // Update navigation buttons
        document.getElementById('btn-prev-puzzle').disabled = index === 0;
        document.getElementById('btn-next-puzzle').disabled = index === puzzles.length - 1;

        const isFlipped = puzzle.playerColor === 'b';

        ChessBoard.init('#practice-board', {
            flipped: isFlipped,
            onMove: handlePuzzleMove,
            interactive: true
        });

        ChessBoard.setLastMove(null);
        ChessBoard.render(puzzleState);
    }

    function handlePuzzleMove(move) {
        const puzzle = ChessPuzzles.getAll()[currentPuzzleIndex];

        // Check if this move matches the expected solution
        const isCorrect = ChessPuzzles.checkMove(puzzle, puzzleMoveIndex, move);

        if (!isCorrect) {
            // Wrong move — shake feedback
            const feedback = document.getElementById('puzzle-feedback');
            feedback.textContent = '❌ Movimiento incorrecto. ¡Inténtalo de nuevo!';
            feedback.className = 'puzzle-feedback wrong';
            ChessBoard.clearSelection();
            ChessBoard.render(puzzleState);
            return;
        }

        // Correct move
        const newState = ChessEngine.makeMove(puzzleState, move);
        if (!newState) return;

        puzzleState = newState;
        puzzleMoveIndex++;
        ChessBoard.setLastMove(move);

        // Check if puzzle is solved
        if (puzzleMoveIndex >= puzzle.solutionMoves.length) {
            const feedback = document.getElementById('puzzle-feedback');
            feedback.textContent = '🎉 ¡Correcto! Puzzle resuelto.';
            feedback.className = 'puzzle-feedback correct';
            ChessBoard.setInteractive(false);
            ChessBoard.render(puzzleState);
            return;
        }

        // Puzzle not done — bot responds, then player continues
        const feedback = document.getElementById('puzzle-feedback');
        feedback.textContent = '✅ ¡Correcto! Sigue...';
        feedback.className = 'puzzle-feedback correct';

        ChessBoard.setInteractive(false);
        ChessBoard.render(puzzleState);

        // Bot auto-response
        setTimeout(() => {
            const botMoveResult = ChessBot.getBestMove(puzzleState, 2);
            if (botMoveResult) {
                const afterBot = ChessEngine.makeMove(puzzleState, botMoveResult);
                if (afterBot) {
                    puzzleState = afterBot;
                    ChessBoard.setLastMove(botMoveResult);
                }
            }
            ChessBoard.setInteractive(true);
            ChessBoard.render(puzzleState);
        }, 500);
    }

    function navigatePuzzle(direction) {
        loadPuzzle(currentPuzzleIndex + direction);
    }

    return { init };
})();

// Boot
document.addEventListener('DOMContentLoaded', () => {
    ChessApp.init();
});
