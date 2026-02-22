/**
 * Chess AI Bot — Minimax with Alpha-Beta Pruning
 */
const ChessBot = (() => {

    const { WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING,
        getLegalMoves, makeMove, isInCheck, cloneState } = ChessEngine;

    // Piece values
    const PIECE_VALUE = {
        [PAWN]: 100,
        [KNIGHT]: 320,
        [BISHOP]: 330,
        [ROOK]: 500,
        [QUEEN]: 900,
        [KING]: 20000
    };

    // Piece-square tables (from white's perspective; flip for black)
    const PST = {
        [PAWN]: [
            [0, 0, 0, 0, 0, 0, 0, 0],
            [50, 50, 50, 50, 50, 50, 50, 50],
            [10, 10, 20, 30, 30, 20, 10, 10],
            [5, 5, 10, 25, 25, 10, 5, 5],
            [0, 0, 0, 20, 20, 0, 0, 0],
            [5, -5, -10, 0, 0, -10, -5, 5],
            [5, 10, 10, -20, -20, 10, 10, 5],
            [0, 0, 0, 0, 0, 0, 0, 0]
        ],
        [KNIGHT]: [
            [-50, -40, -30, -30, -30, -30, -40, -50],
            [-40, -20, 0, 0, 0, 0, -20, -40],
            [-30, 0, 10, 15, 15, 10, 0, -30],
            [-30, 5, 15, 20, 20, 15, 5, -30],
            [-30, 0, 15, 20, 20, 15, 0, -30],
            [-30, 5, 10, 15, 15, 10, 5, -30],
            [-40, -20, 0, 5, 5, 0, -20, -40],
            [-50, -40, -30, -30, -30, -30, -40, -50]
        ],
        [BISHOP]: [
            [-20, -10, -10, -10, -10, -10, -10, -20],
            [-10, 0, 0, 0, 0, 0, 0, -10],
            [-10, 0, 10, 10, 10, 10, 0, -10],
            [-10, 5, 5, 10, 10, 5, 5, -10],
            [-10, 0, 5, 10, 10, 5, 0, -10],
            [-10, 10, 5, 10, 10, 5, 10, -10],
            [-10, 5, 0, 0, 0, 0, 5, -10],
            [-20, -10, -10, -10, -10, -10, -10, -20]
        ],
        [ROOK]: [
            [0, 0, 0, 0, 0, 0, 0, 0],
            [5, 10, 10, 10, 10, 10, 10, 5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [0, 0, 0, 5, 5, 0, 0, 0]
        ],
        [QUEEN]: [
            [-20, -10, -10, -5, -5, -10, -10, -20],
            [-10, 0, 0, 0, 0, 0, 0, -10],
            [-10, 0, 5, 5, 5, 5, 0, -10],
            [-5, 0, 5, 5, 5, 5, 0, -5],
            [0, 0, 5, 5, 5, 5, 0, -5],
            [-10, 5, 5, 5, 5, 5, 0, -10],
            [-10, 0, 5, 0, 0, 0, 0, -10],
            [-20, -10, -10, -5, -5, -10, -10, -20]
        ],
        [KING]: [
            [-30, -40, -40, -50, -50, -40, -40, -30],
            [-30, -40, -40, -50, -50, -40, -40, -30],
            [-30, -40, -40, -50, -50, -40, -40, -30],
            [-30, -40, -40, -50, -50, -40, -40, -30],
            [-20, -30, -30, -40, -40, -30, -30, -20],
            [-10, -20, -20, -20, -20, -20, -20, -10],
            [20, 20, 0, 0, 0, 0, 20, 20],
            [20, 30, 10, 0, 0, 10, 30, 20]
        ]
    };

    function evaluate(state) {
        let score = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = state.board[r][c];
                if (!p) continue;
                const val = PIECE_VALUE[p.type];
                const pstRow = p.color === WHITE ? r : 7 - r;
                const pst = PST[p.type] ? PST[p.type][pstRow][c] : 0;
                if (p.color === WHITE) {
                    score += val + pst;
                } else {
                    score -= val + pst;
                }
            }
        }
        return score;
    }

    function orderMoves(state, moves) {
        return moves.sort((a, b) => {
            let scoreA = 0, scoreB = 0;
            const captA = state.board[a.to.row][a.to.col];
            const captB = state.board[b.to.row][b.to.col];
            if (captA) scoreA += PIECE_VALUE[captA.type] - PIECE_VALUE[state.board[a.from.row][a.from.col].type] / 10;
            if (captB) scoreB += PIECE_VALUE[captB.type] - PIECE_VALUE[state.board[b.from.row][b.from.col].type] / 10;
            if (a.promotion) scoreA += PIECE_VALUE[a.promotion];
            if (b.promotion) scoreB += PIECE_VALUE[b.promotion];
            return scoreB - scoreA;
        });
    }

    function minimax(state, depth, alpha, beta, maximizing) {
        if (depth === 0 || state.gameOver) {
            return { score: evaluate(state), move: null };
        }

        const moves = orderMoves(state, getLegalMoves(state));
        if (moves.length === 0) {
            if (isInCheck(state.board, state.turn)) {
                // Checkmate
                return { score: maximizing ? -99999 + (4 - depth) : 99999 - (4 - depth), move: null };
            }
            // Stalemate
            return { score: 0, move: null };
        }

        let bestMove = moves[0];

        if (maximizing) {
            let maxEval = -Infinity;
            for (const move of moves) {
                const newState = makeMove(state, move);
                if (!newState) continue;
                const result = minimax(newState, depth - 1, alpha, beta, false);
                if (result.score > maxEval) {
                    maxEval = result.score;
                    bestMove = move;
                }
                alpha = Math.max(alpha, result.score);
                if (beta <= alpha) break;
            }
            return { score: maxEval, move: bestMove };
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                const newState = makeMove(state, move);
                if (!newState) continue;
                const result = minimax(newState, depth - 1, alpha, beta, true);
                if (result.score < minEval) {
                    minEval = result.score;
                    bestMove = move;
                }
                beta = Math.min(beta, result.score);
                if (beta <= alpha) break;
            }
            return { score: minEval, move: bestMove };
        }
    }

    function getBestMove(state, depth = 3) {
        const maximizing = state.turn === WHITE;
        const result = minimax(state, depth, -Infinity, Infinity, maximizing);
        return result.move;
    }

    return { getBestMove, evaluate };
})();
