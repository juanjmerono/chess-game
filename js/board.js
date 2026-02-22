/**
 * Chess Board UI — Rendering, interaction, animations
 */
const ChessBoard = (() => {

    const UNICODE_PIECES = {
        wK: '♚', wQ: '♛', wR: '♜', wB: '♝', wN: '♞', wP: '♟',
        bK: '♔', bQ: '♕', bR: '♖', bB: '♗', bN: '♘', bP: '♙'
    };

    let boardEl = null;
    let flipped = false;
    let selectedSquare = null;
    let legalMovesForSelected = [];
    let lastMove = null;
    let onMoveCallback = null;
    let interactive = true;
    let promotionCallback = null;

    function init(containerSelector, opts = {}) {
        boardEl = document.querySelector(containerSelector);
        flipped = opts.flipped || false;
        onMoveCallback = opts.onMove || null;
        interactive = opts.interactive !== undefined ? opts.interactive : true;
    }

    function render(state) {
        if (!boardEl) return;
        boardEl.innerHTML = '';
        boardEl.classList.toggle('flipped', flipped);

        for (let vi = 0; vi < 8; vi++) {
            for (let vj = 0; vj < 8; vj++) {
                const r = flipped ? 7 - vi : vi;
                const c = flipped ? 7 - vj : vj;

                const sq = document.createElement('div');
                sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
                sq.dataset.row = r;
                sq.dataset.col = c;

                // Coordinate labels
                if (vj === 0) {
                    const rankLabel = document.createElement('span');
                    rankLabel.className = 'coord-rank';
                    rankLabel.textContent = 8 - r;
                    sq.appendChild(rankLabel);
                }
                if (vi === 7) {
                    const fileLabel = document.createElement('span');
                    fileLabel.className = 'coord-file';
                    fileLabel.textContent = String.fromCharCode(97 + c);
                    sq.appendChild(fileLabel);
                }

                // Highlights
                if (selectedSquare && selectedSquare.row === r && selectedSquare.col === c) {
                    sq.classList.add('selected');
                }
                if (lastMove) {
                    if ((lastMove.from.row === r && lastMove.from.col === c) ||
                        (lastMove.to.row === r && lastMove.to.col === c)) {
                        sq.classList.add('last-move');
                    }
                }

                // Check highlight
                const piece = state.board[r][c];
                if (piece && piece.type === ChessEngine.KING && piece.color === state.turn &&
                    ChessEngine.isInCheck(state.board, state.turn)) {
                    if (piece.color === state.turn) sq.classList.add('in-check');
                }

                // Legal move dots
                const isLegalTarget = legalMovesForSelected.some(m => m.to.row === r && m.to.col === c);
                if (isLegalTarget) {
                    const dot = document.createElement('div');
                    dot.className = piece ? 'legal-capture' : 'legal-dot';
                    sq.appendChild(dot);
                }

                // Piece
                if (piece) {
                    const pieceEl = document.createElement('div');
                    pieceEl.className = 'piece ' + piece.color;
                    pieceEl.textContent = UNICODE_PIECES[piece.color + piece.type];
                    sq.appendChild(pieceEl);
                }

                // Click handler
                if (interactive && !state.gameOver) {
                    sq.addEventListener('click', () => handleSquareClick(state, r, c));
                }

                boardEl.appendChild(sq);
            }
        }
    }

    function handleSquareClick(state, r, c) {
        const piece = state.board[r][c];

        // If clicking a legal move target => execute move
        if (selectedSquare) {
            const move = legalMovesForSelected.find(m => m.to.row === r && m.to.col === c);
            if (move) {
                // Check for promotion — need to pick piece
                const promotionMoves = legalMovesForSelected.filter(m =>
                    m.to.row === r && m.to.col === c && m.promotion);

                if (promotionMoves.length > 0) {
                    showPromotionDialog(state, promotionMoves);
                    return;
                }

                selectedSquare = null;
                legalMovesForSelected = [];
                lastMove = move;
                if (onMoveCallback) onMoveCallback(move);
                return;
            }
        }

        // Select own piece
        if (piece && piece.color === state.turn) {
            selectedSquare = { row: r, col: c };
            legalMovesForSelected = ChessEngine.getLegalMoves(state).filter(
                m => m.from.row === r && m.from.col === c
            );
            render(state);
            return;
        }

        // Deselect
        selectedSquare = null;
        legalMovesForSelected = [];
        render(state);
    }

    function showPromotionDialog(state, promotionMoves) {
        const color = state.turn;
        const overlay = document.createElement('div');
        overlay.className = 'promotion-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'promotion-dialog';

        const title = document.createElement('div');
        title.className = 'promotion-title';
        title.textContent = '¿Promocionar a?';
        dialog.appendChild(title);

        const options = document.createElement('div');
        options.className = 'promotion-options';

        [ChessEngine.QUEEN, ChessEngine.ROOK, ChessEngine.BISHOP, ChessEngine.KNIGHT].forEach(type => {
            const btn = document.createElement('button');
            btn.className = 'promotion-btn';
            btn.textContent = UNICODE_PIECES[color + type];
            btn.addEventListener('click', () => {
                const move = promotionMoves.find(m => m.promotion === type);
                overlay.remove();
                selectedSquare = null;
                legalMovesForSelected = [];
                lastMove = move;
                if (onMoveCallback) onMoveCallback(move);
            });
            options.appendChild(btn);
        });

        dialog.appendChild(options);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }

    function setFlipped(f) { flipped = f; }
    function setInteractive(i) { interactive = i; }
    function clearSelection() {
        selectedSquare = null;
        legalMovesForSelected = [];
    }
    function setLastMove(m) { lastMove = m; }

    function renderCaptured(state, containerSelector) {
        const el = document.querySelector(containerSelector);
        if (!el) return;

        el.innerHTML = '';

        const pieceOrder = [ChessEngine.QUEEN, ChessEngine.ROOK, ChessEngine.BISHOP, ChessEngine.KNIGHT, ChessEngine.PAWN];

        ['b', 'w'].forEach(capturedColor => {
            const row = document.createElement('div');
            row.className = 'captured-row ' + capturedColor;
            const pieces = state.capturedPieces[capturedColor].slice().sort((a, b) =>
                pieceOrder.indexOf(a) - pieceOrder.indexOf(b)
            );
            pieces.forEach(type => {
                const span = document.createElement('span');
                span.className = 'captured-piece';
                span.textContent = UNICODE_PIECES[capturedColor + type];
                row.appendChild(span);
            });
            el.appendChild(row);
        });
    }

    function renderMoveHistory(state, containerSelector) {
        const el = document.querySelector(containerSelector);
        if (!el) return;
        el.innerHTML = '';

        for (let i = 0; i < state.moveNotations.length; i += 2) {
            const moveNum = Math.floor(i / 2) + 1;
            const row = document.createElement('div');
            row.className = 'move-row';

            const num = document.createElement('span');
            num.className = 'move-num';
            num.textContent = moveNum + '.';
            row.appendChild(num);

            const white = document.createElement('span');
            white.className = 'move-notation';
            white.textContent = state.moveNotations[i];
            row.appendChild(white);

            if (state.moveNotations[i + 1]) {
                const black = document.createElement('span');
                black.className = 'move-notation';
                black.textContent = state.moveNotations[i + 1];
                row.appendChild(black);
            }

            el.appendChild(row);
        }

        el.scrollTop = el.scrollHeight;
    }

    return {
        init, render, setFlipped, setInteractive, clearSelection,
        setLastMove, renderCaptured, renderMoveHistory
    };
})();
