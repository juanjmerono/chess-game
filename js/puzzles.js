/**
 * Chess Puzzles — Tactical positions with solutions
 */
const ChessPuzzles = (() => {

    const puzzles = [
        {
            id: 1,
            title: 'Mate en 1',
            description: 'Blancas juegan y dan mate en un movimiento.',
            fen: '6k1/5ppp/8/8/8/8/1Q6/K7 w - - 0 1',
            solution: ['Qb8'],  // any notation also works as from-to
            solutionMoves: [{ from: { row: 6, col: 1 }, to: { row: 0, col: 1 } }],
            playerColor: 'w'
        },
        {
            id: 2,
            title: 'Mate en 1 — Dama',
            description: 'Blancas juegan y dan mate.',
            fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
            solution: ['Qxf7'],
            solutionMoves: [{ from: { row: 3, col: 7 }, to: { row: 1, col: 5 } }],
            playerColor: 'w'
        },
        {
            id: 3,
            title: 'Mate en 2 — Sacrificio',
            description: 'Blancas juegan y dan mate en 2 movimientos.',
            fen: 'r2qkb1r/pp2nppp/3p4/2pNN1B1/2BnP3/3P4/PPP2PPP/R2bK2R w KQkq - 0 1',
            solution: ['Nf6', 'Qd8'],
            solutionMoves: [
                { from: { row: 3, col: 4 }, to: { row: 1, col: 5 } },
                // After black responds (engine plays), White mates
                { from: { row: 7, col: 3 }, to: { row: 0, col: 3 } }
            ],
            playerColor: 'w',
            // Bot plays black's response between moves
            botResponses: [null] // bot auto-responds after move 1
        },
        {
            id: 4,
            title: 'Clavada ganadora',
            description: 'Blancas juegan y ganan material con una clavada.',
            fen: 'rnb1kbnr/pppp1ppp/8/4p3/4P1q1/3P4/PPP2PPP/RNBQKBNR w KQkq - 0 1',
            solution: ['Be2'],
            solutionMoves: [{ from: { row: 7, col: 5 }, to: { row: 6, col: 4 } }],
            playerColor: 'w'
        },
        {
            id: 5,
            title: 'Horquilla de caballo',
            description: 'Negras juegan. Encuentra la horquilla de caballo.',
            fen: 'r1bqkbnr/pppppppp/2n5/8/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 2',
            solution: ['Nd4'],
            solutionMoves: [{ from: { row: 2, col: 2 }, to: { row: 4, col: 3 } }],
            playerColor: 'b'
        },
        {
            id: 6,
            title: 'Mate del pasillo',
            description: 'Blancas juegan y dan mate.',
            fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
            solution: ['Ra8'],
            solutionMoves: [{ from: { row: 7, col: 0 }, to: { row: 0, col: 0 } }],
            playerColor: 'w'
        },
        {
            id: 7,
            title: 'Mate con dos torres',
            description: 'Blancas dan mate con las torres.',
            fen: '4k3/8/8/8/8/8/R7/R3K3 w - - 0 1',
            solution: ['Ra8'],
            solutionMoves: [{ from: { row: 6, col: 0 }, to: { row: 0, col: 0 } }],
            playerColor: 'w'
        },
        {
            id: 8,
            title: 'Descubierta letal',
            description: 'Blancas juegan y ganan con un ataque descubierto.',
            fen: 'rn2kb1r/ppp1pppp/5n2/3q4/3P2b1/2N2N2/PPP1BPPP/R1BQK2R w KQkq - 0 1',
            solution: ['Nxd5'],
            solutionMoves: [{ from: { row: 5, col: 2 }, to: { row: 3, col: 3 } }],
            playerColor: 'w'
        }
    ];

    function getAll() {
        return puzzles;
    }

    function getById(id) {
        return puzzles.find(p => p.id === id);
    }

    function checkMove(puzzle, moveIndex, move) {
        if (moveIndex >= puzzle.solutionMoves.length) return false;
        const expected = puzzle.solutionMoves[moveIndex];
        return (
            move.from.row === expected.from.row &&
            move.from.col === expected.from.col &&
            move.to.row === expected.to.row &&
            move.to.col === expected.to.col
        );
    }

    return { getAll, getById, checkMove };
})();
