/**
 * Chess Engine — Move generation, validation, check/checkmate/stalemate
 */
const ChessEngine = (() => {

  // Piece constants
  const EMPTY = null;
  const WHITE = 'w';
  const BLACK = 'b';

  const PAWN   = 'P';
  const KNIGHT = 'N';
  const BISHOP = 'B';
  const ROOK   = 'R';
  const QUEEN  = 'Q';
  const KING   = 'K';

  // ───────── Board State ─────────

  function createInitialState() {
    return {
      board: parseFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR').board,
      turn: WHITE,
      castling: { wK: true, wQ: true, bK: true, bQ: true },
      enPassant: null,   // { row, col } of the en-passant target square
      halfMoveClock: 0,
      fullMoveNumber: 1,
      moveHistory: [],
      capturedPieces: { w: [], b: [] },
      moveNotations: [],
      gameOver: false,
      result: null       // '1-0', '0-1', '1/2-1/2'
    };
  }

  // ───────── FEN ─────────

  function parseFEN(fen) {
    const parts = fen.split(' ');
    const rows = parts[0].split('/');
    const board = [];

    for (let r = 0; r < 8; r++) {
      const row = [];
      for (let c = 0; c < rows[r].length; c++) {
        const ch = rows[r][c];
        if (/\d/.test(ch)) {
          for (let i = 0; i < parseInt(ch); i++) row.push(EMPTY);
        } else {
          const color = ch === ch.toUpperCase() ? WHITE : BLACK;
          row.push({ color, type: ch.toUpperCase() });
        }
      }
      board.push(row);
    }

    const turn = (parts[1] || 'w') === 'w' ? WHITE : BLACK;

    const castleStr = parts[2] || 'KQkq';
    const castling = {
      wK: castleStr.includes('K'),
      wQ: castleStr.includes('Q'),
      bK: castleStr.includes('k'),
      bQ: castleStr.includes('q')
    };

    let enPassant = null;
    if (parts[3] && parts[3] !== '-') {
      enPassant = {
        col: parts[3].charCodeAt(0) - 97,
        row: 8 - parseInt(parts[3][1])
      };
    }

    return {
      board,
      turn,
      castling,
      enPassant,
      halfMoveClock: parseInt(parts[4]) || 0,
      fullMoveNumber: parseInt(parts[5]) || 1
    };
  }

  function stateFromFEN(fen) {
    const parsed = parseFEN(fen);
    return {
      ...parsed,
      moveHistory: [],
      capturedPieces: { w: [], b: [] },
      moveNotations: [],
      gameOver: false,
      result: null
    };
  }

  function boardToFEN(state) {
    let fen = '';
    for (let r = 0; r < 8; r++) {
      let empty = 0;
      for (let c = 0; c < 8; c++) {
        const p = state.board[r][c];
        if (!p) { empty++; continue; }
        if (empty > 0) { fen += empty; empty = 0; }
        const ch = p.color === WHITE ? p.type : p.type.toLowerCase();
        fen += ch;
      }
      if (empty > 0) fen += empty;
      if (r < 7) fen += '/';
    }

    fen += ' ' + state.turn;

    let castle = '';
    if (state.castling.wK) castle += 'K';
    if (state.castling.wQ) castle += 'Q';
    if (state.castling.bK) castle += 'k';
    if (state.castling.bQ) castle += 'q';
    fen += ' ' + (castle || '-');

    if (state.enPassant) {
      fen += ' ' + String.fromCharCode(97 + state.enPassant.col) + (8 - state.enPassant.row);
    } else {
      fen += ' -';
    }

    fen += ' ' + state.halfMoveClock + ' ' + state.fullMoveNumber;
    return fen;
  }

  // ───────── Helpers ─────────

  function inBounds(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  function cloneBoard(board) {
    return board.map(row => row.map(cell => cell ? { ...cell } : null));
  }

  function cloneState(state) {
    return {
      board: cloneBoard(state.board),
      turn: state.turn,
      castling: { ...state.castling },
      enPassant: state.enPassant ? { ...state.enPassant } : null,
      halfMoveClock: state.halfMoveClock,
      fullMoveNumber: state.fullMoveNumber,
      moveHistory: [...state.moveHistory],
      capturedPieces: {
        w: [...state.capturedPieces.w],
        b: [...state.capturedPieces.b]
      },
      moveNotations: [...state.moveNotations],
      gameOver: state.gameOver,
      result: state.result
    };
  }

  function opponent(color) {
    return color === WHITE ? BLACK : WHITE;
  }

  function findKing(board, color) {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (board[r][c] && board[r][c].color === color && board[r][c].type === KING)
          return { row: r, col: c };
    return null;
  }

  // ───────── Pseudo-legal Move Generation ─────────

  function getPseudoMoves(state, color) {
    const moves = [];
    const board = state.board;
    const dir = color === WHITE ? -1 : 1;
    const startRow = color === WHITE ? 6 : 1;
    const promoRow = color === WHITE ? 0 : 7;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p || p.color !== color) continue;

        const from = { row: r, col: c };

        switch (p.type) {
          case PAWN: {
            // Forward
            const nr = r + dir;
            if (inBounds(nr, c) && !board[nr][c]) {
              if (nr === promoRow) {
                [QUEEN, ROOK, BISHOP, KNIGHT].forEach(promo =>
                  moves.push({ from, to: { row: nr, col: c }, promotion: promo }));
              } else {
                moves.push({ from, to: { row: nr, col: c } });
              }
              // Double push
              const nr2 = r + 2 * dir;
              if (r === startRow && !board[nr2][c]) {
                moves.push({ from, to: { row: nr2, col: c } });
              }
            }
            // Captures
            for (const dc of [-1, 1]) {
              const nc = c + dc;
              if (!inBounds(nr, nc)) continue;
              const target = board[nr][nc];
              if (target && target.color !== color) {
                if (nr === promoRow) {
                  [QUEEN, ROOK, BISHOP, KNIGHT].forEach(promo =>
                    moves.push({ from, to: { row: nr, col: nc }, promotion: promo }));
                } else {
                  moves.push({ from, to: { row: nr, col: nc } });
                }
              }
              // En passant
              if (state.enPassant && state.enPassant.row === nr && state.enPassant.col === nc) {
                moves.push({ from, to: { row: nr, col: nc }, enPassant: true });
              }
            }
            break;
          }

          case KNIGHT: {
            const offsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
            for (const [dr, dc] of offsets) {
              const nr = r + dr, nc = c + dc;
              if (!inBounds(nr, nc)) continue;
              if (!board[nr][nc] || board[nr][nc].color !== color)
                moves.push({ from, to: { row: nr, col: nc } });
            }
            break;
          }

          case BISHOP: {
            slideMoves(board, color, from, [[-1,-1],[-1,1],[1,-1],[1,1]], moves);
            break;
          }

          case ROOK: {
            slideMoves(board, color, from, [[-1,0],[1,0],[0,-1],[0,1]], moves);
            break;
          }

          case QUEEN: {
            slideMoves(board, color, from, [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]], moves);
            break;
          }

          case KING: {
            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = r + dr, nc = c + dc;
                if (!inBounds(nr, nc)) continue;
                if (!board[nr][nc] || board[nr][nc].color !== color)
                  moves.push({ from, to: { row: nr, col: nc } });
              }
            }
            // Castling
            const row = color === WHITE ? 7 : 0;
            if (r === row && c === 4) {
              // King-side
              const ksKey = color + 'K';
              if (state.castling[ksKey] && !board[row][5] && !board[row][6] &&
                  board[row][7] && board[row][7].type === ROOK && board[row][7].color === color) {
                moves.push({ from, to: { row, col: 6 }, castling: 'K' });
              }
              // Queen-side
              const qsKey = color + 'Q';
              if (state.castling[qsKey] && !board[row][3] && !board[row][2] && !board[row][1] &&
                  board[row][0] && board[row][0].type === ROOK && board[row][0].color === color) {
                moves.push({ from, to: { row, col: 2 }, castling: 'Q' });
              }
            }
            break;
          }
        }
      }
    }
    return moves;
  }

  function slideMoves(board, color, from, dirs, moves) {
    for (const [dr, dc] of dirs) {
      let r = from.row + dr, c = from.col + dc;
      while (inBounds(r, c)) {
        if (board[r][c]) {
          if (board[r][c].color !== color)
            moves.push({ from, to: { row: r, col: c } });
          break;
        }
        moves.push({ from, to: { row: r, col: c } });
        r += dr; c += dc;
      }
    }
  }

  // ───────── Attack Detection ─────────

  function isSquareAttacked(board, row, col, byColor) {
    // Check by knights
    const knightOffsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (const [dr, dc] of knightOffsets) {
      const r = row + dr, c = col + dc;
      if (inBounds(r, c) && board[r][c] && board[r][c].color === byColor && board[r][c].type === KNIGHT)
        return true;
    }

    // Check by king
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr, c = col + dc;
        if (inBounds(r, c) && board[r][c] && board[r][c].color === byColor && board[r][c].type === KING)
          return true;
      }
    }

    // Check by pawns
    const pawnDir = byColor === WHITE ? 1 : -1; // pawns attack in opposite to their move dir
    for (const dc of [-1, 1]) {
      const r = row + pawnDir, c = col + dc;
      if (inBounds(r, c) && board[r][c] && board[r][c].color === byColor && board[r][c].type === PAWN)
        return true;
    }

    // Check by sliding pieces (bishop/queen diag, rook/queen straight)
    const diagDirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
    for (const [dr, dc] of diagDirs) {
      let r = row + dr, c = col + dc;
      while (inBounds(r, c)) {
        if (board[r][c]) {
          if (board[r][c].color === byColor && (board[r][c].type === BISHOP || board[r][c].type === QUEEN))
            return true;
          break;
        }
        r += dr; c += dc;
      }
    }

    const straightDirs = [[-1,0],[1,0],[0,-1],[0,1]];
    for (const [dr, dc] of straightDirs) {
      let r = row + dr, c = col + dc;
      while (inBounds(r, c)) {
        if (board[r][c]) {
          if (board[r][c].color === byColor && (board[r][c].type === ROOK || board[r][c].type === QUEEN))
            return true;
          break;
        }
        r += dr; c += dc;
      }
    }

    return false;
  }

  function isInCheck(board, color) {
    const king = findKing(board, color);
    if (!king) return false;
    return isSquareAttacked(board, king.row, king.col, opponent(color));
  }

  // ───────── Legal Moves ─────────

  function getLegalMoves(state, color) {
    color = color || state.turn;
    const pseudoMoves = getPseudoMoves(state, color);
    const legalMoves = [];

    for (const move of pseudoMoves) {
      // Castling: king must not be in check, must not pass through check
      if (move.castling) {
        if (isInCheck(state.board, color)) continue;
        const row = move.from.row;
        if (move.castling === 'K') {
          if (isSquareAttacked(state.board, row, 5, opponent(color))) continue;
          if (isSquareAttacked(state.board, row, 6, opponent(color))) continue;
        } else {
          if (isSquareAttacked(state.board, row, 3, opponent(color))) continue;
          if (isSquareAttacked(state.board, row, 2, opponent(color))) continue;
        }
      }

      // Apply move on a copy and check if own king is in check
      const newBoard = cloneBoard(state.board);
      applyMoveToBoard(newBoard, move);
      if (!isInCheck(newBoard, color)) {
        legalMoves.push(move);
      }
    }

    return legalMoves;
  }

  function applyMoveToBoard(board, move) {
    const piece = board[move.from.row][move.from.col];
    board[move.from.row][move.from.col] = null;

    if (move.enPassant) {
      // Remove captured pawn
      const capturedRow = move.from.row;
      board[capturedRow][move.to.col] = null;
    }

    if (move.castling) {
      const row = move.from.row;
      if (move.castling === 'K') {
        board[row][5] = board[row][7];
        board[row][7] = null;
      } else {
        board[row][3] = board[row][0];
        board[row][0] = null;
      }
    }

    if (move.promotion) {
      board[move.to.row][move.to.col] = { color: piece.color, type: move.promotion };
    } else {
      board[move.to.row][move.to.col] = piece;
    }
  }

  // ───────── Make Move ─────────

  function makeMove(state, move) {
    const newState = cloneState(state);
    const piece = newState.board[move.from.row][move.from.col];
    if (!piece) return null;

    const captured = newState.board[move.to.row][move.to.col];

    // Record notation before applying
    const notation = getMoveNotation(newState, move, piece, captured);

    // Track captured pieces
    if (captured) {
      newState.capturedPieces[captured.color].push(captured.type);
    }
    if (move.enPassant) {
      newState.capturedPieces[opponent(piece.color)].push(PAWN);
    }

    // Apply to board
    applyMoveToBoard(newState.board, move);

    // Update en passant
    newState.enPassant = null;
    if (piece.type === PAWN && Math.abs(move.to.row - move.from.row) === 2) {
      newState.enPassant = {
        row: (move.from.row + move.to.row) / 2,
        col: move.from.col
      };
    }

    // Update castling rights
    if (piece.type === KING) {
      newState.castling[piece.color + 'K'] = false;
      newState.castling[piece.color + 'Q'] = false;
    }
    if (piece.type === ROOK) {
      if (move.from.col === 0) newState.castling[piece.color + 'Q'] = false;
      if (move.from.col === 7) newState.castling[piece.color + 'K'] = false;
    }
    // Also remove castling if a rook is captured
    if (captured && captured.type === ROOK) {
      if (move.to.col === 0) newState.castling[captured.color + 'Q'] = false;
      if (move.to.col === 7) newState.castling[captured.color + 'K'] = false;
    }

    // Half-move clock
    if (piece.type === PAWN || captured || move.enPassant) {
      newState.halfMoveClock = 0;
    } else {
      newState.halfMoveClock++;
    }

    // Full move number
    if (piece.color === BLACK) newState.fullMoveNumber++;

    // Switch turn
    newState.turn = opponent(piece.color);

    // Save move to history
    newState.moveHistory.push({
      move,
      captured,
      prevCastling: { ...state.castling },
      prevEnPassant: state.enPassant
    });

    // Check for check/checkmate/stalemate
    const opponentMoves = getLegalMoves(newState, newState.turn);
    const inCheck = isInCheck(newState.board, newState.turn);

    let finalNotation = notation;
    if (opponentMoves.length === 0) {
      if (inCheck) {
        finalNotation += '#';
        newState.gameOver = true;
        newState.result = piece.color === WHITE ? '1-0' : '0-1';
      } else {
        newState.gameOver = true;
        newState.result = '1/2-1/2';
      }
    } else if (inCheck) {
      finalNotation += '+';
    }

    // Insufficient material
    if (!newState.gameOver && isInsufficientMaterial(newState.board)) {
      newState.gameOver = true;
      newState.result = '1/2-1/2';
    }

    // 50-move rule
    if (!newState.gameOver && newState.halfMoveClock >= 100) {
      newState.gameOver = true;
      newState.result = '1/2-1/2';
    }

    newState.moveNotations.push(finalNotation);

    return newState;
  }

  // ───────── Notation ─────────

  function getMoveNotation(state, move, piece, captured) {
    if (move.castling === 'K') return 'O-O';
    if (move.castling === 'Q') return 'O-O-O';

    let notation = '';
    const colLetter = c => String.fromCharCode(97 + c);

    if (piece.type !== PAWN) {
      notation += piece.type;
      // Disambiguation
      const samePieceMoves = getPseudoMoves(state, piece.color).filter(m =>
        m.to.row === move.to.row && m.to.col === move.to.col &&
        state.board[m.from.row][m.from.col] &&
        state.board[m.from.row][m.from.col].type === piece.type &&
        (m.from.row !== move.from.row || m.from.col !== move.from.col)
      );
      if (samePieceMoves.length > 0) {
        const sameCol = samePieceMoves.some(m => m.from.col === move.from.col);
        const sameRow = samePieceMoves.some(m => m.from.row === move.from.row);
        if (!sameCol) {
          notation += colLetter(move.from.col);
        } else if (!sameRow) {
          notation += (8 - move.from.row);
        } else {
          notation += colLetter(move.from.col) + (8 - move.from.row);
        }
      }
    }

    if (captured || move.enPassant) {
      if (piece.type === PAWN) notation += colLetter(move.from.col);
      notation += 'x';
    }

    notation += colLetter(move.to.col) + (8 - move.to.row);

    if (move.promotion) notation += '=' + move.promotion;

    return notation;
  }

  // ───────── Draw Detection ─────────

  function isInsufficientMaterial(board) {
    const pieces = { w: [], b: [] };
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type !== KING) {
          pieces[p.color].push({ type: p.type, row: r, col: c });
        }
      }
    }
    const wp = pieces.w, bp = pieces.b;
    // K vs K
    if (wp.length === 0 && bp.length === 0) return true;
    // K vs K+B or K vs K+N
    if (wp.length === 0 && bp.length === 1 && (bp[0].type === BISHOP || bp[0].type === KNIGHT)) return true;
    if (bp.length === 0 && wp.length === 1 && (wp[0].type === BISHOP || wp[0].type === KNIGHT)) return true;
    // K+B vs K+B same color bishops
    if (wp.length === 1 && bp.length === 1 && wp[0].type === BISHOP && bp[0].type === BISHOP) {
      const wBishopColor = (wp[0].row + wp[0].col) % 2;
      const bBishopColor = (bp[0].row + bp[0].col) % 2;
      if (wBishopColor === bBishopColor) return true;
    }
    return false;
  }

  // ───────── Public API ─────────

  return {
    WHITE, BLACK,
    PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING,
    createInitialState,
    stateFromFEN,
    boardToFEN,
    parseFEN,
    cloneState,
    cloneBoard,
    getLegalMoves,
    makeMove,
    isInCheck,
    isSquareAttacked,
    findKing,
    opponent,
    getPseudoMoves,
    applyMoveToBoard
  };
})();
