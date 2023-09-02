/**
 * Inside this file you will use the classes and functions from rx.js
 * to add visuals to the svg element in index.html, animate them, and make them interactive.
 *
 * Study and complete the tasks in observable exercises first to get ideas.
 *
 * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
 *
 * You will be marked on your functional programming style
 * as well as the functionality that you implement.
 *
 * Document your code!
 */

import "./style.css";

import { fromEvent, interval, merge, BehaviorSubject } from "rxjs";
import { map, filter, scan, switchMap, distinctUntilChanged } from "rxjs/operators";

/** Constants */

const Viewport = {
  CANVAS_WIDTH: 200,
  CANVAS_HEIGHT: 400,
  PREVIEW_WIDTH: 160,
  PREVIEW_HEIGHT: 80,
} as const;

const Constants = {
  TICK_RATE_MS: 500,
  GRID_WIDTH: 10,
  GRID_HEIGHT: 20,
} as const;

const Block = {
  WIDTH: Viewport.CANVAS_WIDTH / Constants.GRID_WIDTH,
  HEIGHT: Viewport.CANVAS_HEIGHT / Constants.GRID_HEIGHT,
};

/** User input */

type Key = "KeyS" | "KeyA" | "KeyD" | "KeyR";

type Event = "keydown" | "keyup" | "keypress";

/** Utility functions */

/** 
 * Sets ups the current state.
 *
 * @returns Piece[] A list of Pieces
 */
const preparePieces = (): Piece[] => {
  // Set up cubes
  const createCube = (x: number, y: number) => ({
    height: `${Block.HEIGHT}`,
    width: `${Block.WIDTH}`,
    x: `${Block.WIDTH * (x - 1)}`,
    y: `${Block.HEIGHT * (y - 1)}`,
    style: "fill: green",
  });
  // Construct pieces with blocks
  const createPiece = (...positions: [number, number][]) => ({
    static: false,
    cubeList: positions.map(pos => createCube(...pos)),
  });
  const Opiece = createPiece([5, 1], [6, 1], [5, 2], [6, 2]);
  const Ipiece = createPiece([6, 1], [6, 2], [6, 3], [6, 4]);
  const Jpiece = createPiece([4, 1], [5, 1], [6, 1], [6, 2]);
  const Lpiece = createPiece([4, 1], [5, 1], [6, 1], [4, 2]);
  const Tpiece = createPiece([4, 1], [5, 1], [6, 1], [5, 2]);
  const Spiece = createPiece([5, 1], [6, 1], [4, 2], [5, 2]);
  const Zpiece = createPiece([4, 1], [5, 1], [5, 2], [6, 2]);
  // Construct pieces with blocks
  const storedPieces: Piece[] = [Opiece]; //, Ipiece, Jpiece, Lpiece, Tpiece, Spiece, Zpiece
  return storedPieces;
};

/** 
 * Gets a random piece using Math functions from a list of pieces.
 *
 * @param storedPieces A list of Pieces that are stored
 * @returns Piece 
 */
const getRandomPiece = (storedPieces: Piece[]) => {
  const randomIndex = Math.floor(Math.random() * storedPieces.length);
  return storedPieces[randomIndex]; 
};

/** State processing */

type State = Readonly<{
  gameEnd: boolean,
  gameGrid: CubeProps[][],
  storedPieces: Piece[],
  currentPiece: Piece,
  nextPiece: Piece,
  level: number,
  score: number,
  highScore: number,
}>;

/** 
 * Provides an interface for cubes/blocks
 */
type CubeProps =  {
  height: string,
  width: string,
  x: string,
  y: string,
  style: string,
};

/** 
 * Provides an interface for pieces that consist of cubes
 */
type Piece = {
  static: boolean,
  cubeList: CubeProps[],
};

/** 
 * Create initial stored pieces
 */
const initialStoredPieces = preparePieces();

/** 
 * Create secondary stored pieces to prevent nextPiece from using the same piece as currentPiece
 */
const secondaryStoredPieces = preparePieces();

const initialState: State = {
  gameEnd: false,
  gameGrid: Array.from(
    { length: Constants.GRID_HEIGHT },
    () => Array(Constants.GRID_WIDTH).fill(null)
  ),
  storedPieces: [...initialStoredPieces], // Clone the initial stored pieces
  currentPiece: getRandomPiece(initialStoredPieces), // Get a random piece from the initial stored pieces
  nextPiece: getRandomPiece(secondaryStoredPieces), // Get a random piece from the secondary stored pieces
  level: 0,
  score: 0,
  highScore: 0,
};

/**
 * Checks for collisions in a specific direction for the current piece.
 *
 * @param {Piece} piece - The piece being moved.
 * @param {CubeProps[][]} gameGrid - The current state of the game grid.
 * @param {number} offsetX - The offset in the X direction (negative for left, positive for right).
 * @param {number} offsetY - The offset in the Y direction (positive for downward movement).
 * @returns {boolean} True if there is a collision, false otherwise.
 */
const isCollision = (piece: Piece, gameGrid: CubeProps[][], offsetX: number, offsetY: number): boolean => {
  return piece.cubeList.some(cubeProps => {
    const cubeX = Math.floor(Number(cubeProps.x) / Block.WIDTH);
    const cubeY = Math.floor(Number(cubeProps.y) / Block.HEIGHT);
    // Determine the future position of the cube
    const targetX = cubeX + offsetX;
    const targetY = cubeY + offsetY;
    // Check for boundaries and collision with existing blocks
    return (
      targetX < 0 || targetX >= Constants.GRID_WIDTH ||
      targetY >= Constants.GRID_HEIGHT || gameGrid[targetY][targetX] !== null
    );
  });
};

/**
 * Checks if there is a collision to the left of the current piece.
 *
 * @param {Piece} piece - The piece being moved.
 * @param {CubeProps[][]} gameGrid - The current state of the game grid.
 * @returns {boolean} True if there is a collision to the left, false otherwise.
 */
const isCollisionLeft = (piece: Piece, gameGrid: CubeProps[][]): boolean => {
  return isCollision(piece, gameGrid, -1, 0);
};

/**
 * Checks if there is a collision to the right of the current piece.
 *
 * @param {Piece} piece - The piece being moved.
 * @param {CubeProps[][]} gameGrid - The current state of the game grid.
 * @returns {boolean} True if there is a collision to the right, false otherwise.
 */
const isCollisionRight = (piece: Piece, gameGrid: CubeProps[][]): boolean => {
  return isCollision(piece, gameGrid, 1, 0);
};

/**
 * Checks if there is a collision below the current piece.
 *
 * @param {Piece} piece - The piece being moved.
 * @param {CubeProps[][]} gameGrid - The current state of the game grid.
 * @returns {boolean} True if there is a collision below, false otherwise.
 */
const isCollisionDown = (piece: Piece, gameGrid: CubeProps[][]): boolean => {
  return isCollision(piece, gameGrid, 0, 1);
};

/**
 * Handles moving the current piece to the left if possible.
 *
 * @param {State} state - The current state of the game.
 * @returns {State} The updated state after moving the piece left if possible.
 */
const movePieceLeft = (state: State): State => {
  const currentPiece = state.currentPiece;
  const canMoveLeft = currentPiece.cubeList.every(cubeProps => {
    const cubeX = Math.floor(Number(cubeProps.x) / Block.WIDTH);
    return cubeX > 0; // Check if moving left is within the grid boundaries
  });
  if (canMoveLeft && !isCollisionLeft(currentPiece, state.gameGrid)) {
    const updatedCubeList = currentPiece.cubeList.map(cubeProps => ({
      ...cubeProps,
      x: String(Number(cubeProps.x) - Block.WIDTH),
    }));
    const updatedPiece = { ...currentPiece, cubeList: updatedCubeList };
    return {
      ...state,
      currentPiece: updatedPiece,
    };
  }
  return state;
};

/**
 * Handles moving the current piece to the right if possible.
 *
 * @param {State} state - The current state of the game.
 * @returns {State} The updated state after moving the piece right if possible.
 */
const movePieceRight = (state: State): State => {
  const currentPiece = state.currentPiece;
  const canMoveRight = currentPiece.cubeList.every(cubeProps => {
    const cubeX = Math.floor(Number(cubeProps.x) / Block.WIDTH);
    return cubeX < Constants.GRID_WIDTH - 1; // Check if moving right is within the grid boundaries
  });
  if (canMoveRight && !isCollisionRight(currentPiece, state.gameGrid)) {
    const updatedCubeList = currentPiece.cubeList.map(cubeProps => ({
      ...cubeProps,
      x: String(Number(cubeProps.x) + Block.WIDTH),
    }));
    const updatedPiece = { ...currentPiece, cubeList: updatedCubeList };
    return {
      ...state,
      currentPiece: updatedPiece,
    };
  }
  return state;
};

/**
 * Handles moving the current piece directly to the bottom position or until it meets another cube below it.
 *
 * @param state The current state of the game.
 * @returns The updated state after moving the piece to the bottom position.
 */
const movePieceDown = (state: State): State => {
  const updatedPiece = descend(state.currentPiece, state.gameGrid);
  if (isCollisionDown(updatedPiece, state.gameGrid)) {
    // If collision is detected, return the state with the updated piece position
    return {
      ...state,
      currentPiece: updatedPiece,
    };
  }
  // Recursively call movePieceDown with the updated piece position
  return movePieceDown({
    ...state,
    currentPiece: updatedPiece,
  });
};

/**
 * Descends the current piece vertically if possible.
 *
 * @param piece The current piece to be descended.
 * @param gameGrid The 2D array representing the current state of the game grid.
 * @returns The updated piece after descent.
 */
const descend = (piece: Piece, gameGrid: CubeProps[][]): Piece => {
  // Create a copy of the current piece to avoid modifying the original piece
  const updatedPiece = { ...piece };
  // Check if the piece can descend using isCollisionDown
  const canDescend = !isCollisionDown(updatedPiece, gameGrid);
  // Perform cube position updates
  if (canDescend) {
    updatedPiece.cubeList.forEach(cubeProps => {
      // Move each cube's position downward by one block
      cubeProps.y = String(Number(cubeProps.y) + Block.HEIGHT);
    });
  } else {
    updatedPiece.static = true;
  }
  // Return the updated piece after descent
  return updatedPiece;
};

/**
 * Register the piece in the grid when it does not need to move.
 *
 * @param gameGrid An array of CubeProps
 * @returns Updated gameGrid
 */
const registerGameGrid = (gameGrid: CubeProps[][], piece: Piece): CubeProps[][] => {
  const updatedGrid = gameGrid.map(row => [...row]); // Create a copy of the gameGrid
  // Only register the piece if it is static
  if (piece.static) {
    // Determine the position of the cube
    piece.cubeList.forEach(cubeProps => {
      const cubeX = Math.floor(Number(cubeProps.x) / Block.WIDTH);
      const cubeY = Math.floor(Number(cubeProps.y) / Block.HEIGHT);
      // Adds cubeProps into grid 
      updatedGrid[cubeY][cubeX] = cubeProps;
    });
  }
  return updatedGrid;
};

/**
 * Adjusts the score and highest score for each filled row in the gameGrid.
 *
 * @param gameGrid The 2D array representing the current state of the game grid.
 * @param score The current score.
 * @param highScore The current highest score.
 * @returns The updated score and the updated highest score.
 */
const ScoreAdjustment = (gameGrid: CubeProps[][], score: number, highScore: number): { updatedScore: number; updatedHighScore: number } => {
  // Clone the gameGrid to avoid modifying the original grid
  const updatedScore = [...gameGrid].reduce((acc, row) => {
    // Check if all cubeProps in the row are not null (i.e., the row is filled)
    const isRowFilled = row.every(cubeProps => cubeProps !== null);
    if (isRowFilled) {
      // If the row is filled, increment the score by 1
      return acc + 1;
    }
    return acc;
  }, score);
  const updatedHighScore = (updatedScore > highScore) ? updatedScore : highScore;
  return {updatedScore, updatedHighScore};
};

/**
 * Checks if the game is over by checking if any cube in the top row of the grid is filled.
 * @param gameGrid The 2D array representing the current state of the game grid.
 * @returns True if the game is over, false otherwise.
 */
const checkGameOver = (gameGrid: CubeProps[][]): boolean => {
  return gameGrid[0].some(cubeProps => cubeProps !== null);
};

/**
 * Clears filled lines from the game grid by removing completed rows and shifting pieces down.
 *
 * @param state The current state of the game.
 * @returns The updated state of the game after rows are eliminated.
 */
const eliminateRow = (state: State): State => {
  // Store the indices of filled rows
  const filledRows = state.gameGrid
    .map((row, rowIndex) => (row.every(cell => cell !== null) ? rowIndex : -1))
    .filter(index => index !== -1);
  // Create the updated game grid by filtering out filled rows
  const updatedGameGrid = state.gameGrid.filter((_, rowIndex) => !filledRows.includes(rowIndex));
  // Calculate the number of new empty rows to add at the top of the grid
  const numberOfRowsToAdd = state.gameGrid.length - updatedGameGrid.length;
  // Combine the new rows and the remaining grid to create the final updated grid
  const newRows = Array.from({ length: numberOfRowsToAdd }, () => Array(Constants.GRID_WIDTH).fill(null));
  const finalGrid = [...newRows, ...updatedGameGrid].slice(0, Constants.GRID_HEIGHT);
  // Create a copy of the final grid to avoid modifying the original grid
  const updatedGameGridWithAdjustedPositions = finalGrid.map((row, rowIndex) => {
    // If the row is above the eliminated rows, update cube positions
    if (rowIndex < state.gameGrid.length - filledRows.length) {
      const adjustedRow = row.map(cubeProps => {
        if (cubeProps !== null) {
          const newY = String(Number(cubeProps.y) + filledRows.length * Block.HEIGHT);
          return { ...cubeProps, y: newY };
        }
        return cubeProps;
      });
      return adjustedRow;
    }
    // Otherwise, return the row without changes
    return row;
  });
  // Create an updated state with the new game grid
  const updatedState: State = {
    ...state,
    gameGrid: updatedGameGridWithAdjustedPositions,
  };
  return updatedState;
};

/**
 * Replaces the current piece with next piece and next piece with random piece if current piece is static and the game is not over.
 *
 * @param currentState Current state
 * @returns Updated state
 */
const checkAndReplacePiece = (currentState: State) => {
  // Check if the game has not ended and the current piece is static
  if (!currentState.gameEnd && currentState.currentPiece.static) {
    // Update the list of available pieces
    const updatedStoredPieces = preparePieces();
    // Update current piece with next piece
    const updatedCurrentPiece = currentState.nextPiece;
    // Get a random piece from the updated list of available pieces
    const updatedNextPiece = getRandomPiece(updatedStoredPieces);
    return {
      ...currentState,
      currentPiece: updatedCurrentPiece,
      nextPiece: updatedNextPiece,
    };
  }
  return currentState;
};

/**
 * Restarts the game by resetting the game state to its initial values.
 *
 * @param {State} state - The current state of the game.
 * @returns {State} - The updated game state with initial values.
 */
const restartGame = (state: State): State => {
  // Create a list of initial stored pieces
  const initialStoredPieces = preparePieces();
  // Define the initial game state
  const initialGameState = {
    ...state,
    gameEnd: false, // The game is not over
    gameGrid: Array.from(
      { length: Constants.GRID_HEIGHT },
      () => Array(Constants.GRID_WIDTH).fill(null)
    ), // Create an empty game grid
    storedPieces: [...initialStoredPieces], // Clone the initial stored pieces
    currentPiece: getRandomPiece(initialStoredPieces), // Get a random piece from the initial stored pieces
    nextPiece: getRandomPiece(initialStoredPieces), // Get the next random piece
    level: 0,
    score: 0,
  };
  return { ...initialGameState };
};

/**
 * Updates the state by descending the current piece and checks for game over.
 *
 * @param s Current state
 * @returns Updated state
 */
const tick = (s: State): State => {
  // Call the descend function to update the piece's position
  const updatedPiece = descend(s.currentPiece, s.gameGrid);
  // Update gameGrid with the positions of the current piece's cubeProps
  const updatedGrid = registerGameGrid(s.gameGrid, updatedPiece);
  // Update score with every filled row
  const { updatedScore, updatedHighScore } = ScoreAdjustment(updatedGrid, s.score, s.highScore);
  // Check if the game is over using the checkGameOver function
  const gameEnd = checkGameOver(updatedGrid);
  // Create an updated state
  const updatedState: State = {
    ...s,
    gameGrid: updatedGrid,
    currentPiece: updatedPiece,
    gameEnd: gameEnd,
    level: updatedScore,
    score: updatedScore,
    highScore: updatedHighScore
  };
  const stateAfterElimination = eliminateRow(updatedState)
  // Check and replace the piece if needed
  const stateAfterReplacement = checkAndReplacePiece(stateAfterElimination); 
  // Return the updated state
  return stateAfterReplacement;
};

/** Rendering (side effects) */

/**
 * Displays a SVG element on the canvas. Brings to foreground.
 * @param elem SVG element to display
 */
const show = (elem: SVGGraphicsElement) => {
  elem.setAttribute("visibility", "visible");
  elem.parentNode!.appendChild(elem);
};

/**
 * Hides a SVG element on the canvas.
 * @param elem SVG element to hide
 */
const hide = (elem: SVGGraphicsElement) =>
  elem.setAttribute("visibility", "hidden");

/**
 * Creates an SVG element with the given properties.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element for valid
 * element names and properties.
 *
 * @param namespace Namespace of the SVG element
 * @param name SVGElement name
 * @param props Properties to set on the SVG element
 * @returns SVG element
 */
const createSvgElement = (
  namespace: string | null,
  name: string,
  props: Record<string, string> = {}
) => {
  const elem = document.createElementNS(namespace, name) as SVGElement;
  Object.entries(props).forEach(([k, v]) => elem.setAttribute(k, v));
  return elem;
};

/**
 * This is the function called on page load. Your main game loop
 * should be called here.
 */
export function main() {
  // Canvas elements
  const svg = document.querySelector("#svgCanvas") as SVGGraphicsElement &
    HTMLElement;
  const preview = document.querySelector("#svgPreview") as SVGGraphicsElement &
    HTMLElement;
  const gameover = document.querySelector("#gameOver") as SVGGraphicsElement &
    HTMLElement;
  const container = document.querySelector("#main") as HTMLElement;

  svg.setAttribute("height", `${Viewport.CANVAS_HEIGHT}`);
  svg.setAttribute("width", `${Viewport.CANVAS_WIDTH}`);
  preview.setAttribute("height", `${Viewport.PREVIEW_HEIGHT}`);
  preview.setAttribute("width", `${Viewport.PREVIEW_WIDTH}`);

  // Text fields
  const levelText = document.querySelector("#levelText") as HTMLElement;
  const scoreText = document.querySelector("#scoreText") as HTMLElement;
  const highScoreText = document.querySelector("#highScoreText") as HTMLElement;

  /** User input */

  const key$ = fromEvent<KeyboardEvent>(document, "keypress");

  const fromKey = (keyCode: Key) =>
    key$.pipe(filter(({ code }) => code === keyCode));

  const left$ = fromKey("KeyA");
  const right$ = fromKey("KeyD");
  const down$ = fromKey("KeyS");
  const restart$ = fromKey("KeyR")

  /** Observables */

  // Track the score changes with an initial value of 0
  const scoreSubject = new BehaviorSubject<number>(0);

  // Observable that emits the current score whenever it changes
  const score$ = scoreSubject.pipe(
    distinctUntilChanged(), // Only emit when the score changes
  );

  // Tick rate based on the score
  const dynamicTick$ = score$.pipe(
    switchMap(score => {
      // Calculate the tick rate based on the score (modify this calculation as needed)
      const maxTickRate = Constants.TICK_RATE_MS; // The initial tick rate
      const minTickRate = 100; // The minimum tick rate (adjust as needed)
      const maxScore = 10; // The score at which the tick rate stops decreasing
      const tickRateRange = maxTickRate - minTickRate;
      // Calculate the new tick rate based on the score
      const newTickRate = maxTickRate - (score / maxScore) * tickRateRange;
      // Ensure the new tick rate does not go below the minimum
      return interval(newTickRate);
    })
  );

  /**
   * Renders the current state to the canvas.
   *
   * In MVC terms, this updates the View using the Model.
   *
   * @param s Current state
   */
  const renderTetris = (s: State) => {
    // Remove SVG elements rendered with past cubes in the current piece
    const existingElements = document.querySelectorAll(".cube");
    existingElements.forEach(element => element.remove());
    // Render the current piece by creating and appending new SVG elements
    s.currentPiece.cubeList.forEach(cubeProps => {
      const cubeSvg = createSvgElement(
        svg.namespaceURI, "rect", { ...cubeProps }
      );
      cubeSvg.classList.add("cube"); // Add a class to identify the elements
      svg.appendChild(cubeSvg);
    });
    // Render the cubes in the gameGrid
    s.gameGrid.forEach((row) => {
      row.forEach((cubeProps) => {
        if (cubeProps !== null) {
          const cubeSvg = createSvgElement(
            svg.namespaceURI, "rect", { ...cubeProps }
          );
          cubeSvg.classList.add("cube");
          svg.appendChild(cubeSvg);
        }
      });
    });
  }

  const renderHUD = (s: State) => {
    // Render the next piece in the preview canvas
    const nextPiece = s.nextPiece;
    // Clear previous preview content
    preview.innerHTML = ""; 
    nextPiece.cubeList.forEach(cubeProps => {
      const cubePreview = createSvgElement(preview.namespaceURI, "rect", {
        ...cubeProps,
        x: `${Number(cubeProps.x) - Block.WIDTH}`, // Adjust the x position for preview
      });
      preview.appendChild(cubePreview);
    });
    // Display Level
    if (levelText) {
      levelText.textContent = `${s.level}`; 
    }
    // Display Score
    if (scoreText) {
      scoreText.textContent = `${s.score}`; 
    }
    // Display HighScore
    if (highScoreText) {
      highScoreText.textContent = `${s.highScore}`; 
    }
    scoreSubject.next(s.score);
  };

  const source$ = merge(
    dynamicTick$.pipe(map(() => (state: State) => tick(state))),
    left$.pipe(map(() => (state: State) => movePieceLeft(state))),
    right$.pipe(map(() => (state: State) => movePieceRight(state))),
    down$.pipe(map(() => (state: State) => movePieceDown(state))),
    restart$.pipe(map(() => (state: State) => restartGame(state)))
  ).pipe(
    scan((s: State, action: (s: State) => State) => action(s), initialState)
  );
  source$.subscribe((s: State) => {
    renderTetris(s);
    renderHUD(s);
    if (s.gameEnd) {
      show(gameover);
    } else {
      hide(gameover);
    }
  });
}

// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}
