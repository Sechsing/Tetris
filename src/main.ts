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

import { fromEvent, interval, merge } from "rxjs";
import { map, filter, scan } from "rxjs/operators";

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

type Key = "KeyS" | "KeyA" | "KeyD";

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
  const createPiece = (shape: string, ...positions: [number, number][]) => ({
    shape,
    static: false,
    cubeList: positions.map(pos => createCube(...pos)),
  });
  const Opiece = createPiece("O", [5, 1], [6, 1], [5, 2], [6, 2]);
  const Ipiece = createPiece("I", [6, 1], [6, 2], [6, 3], [6, 4]);
  const Jpiece = createPiece("J", [4, 1], [5, 1], [6, 1], [6, 2]);
  const Lpiece = createPiece("L", [4, 1], [5, 1], [6, 1], [4, 2]);
  const Tpiece = createPiece("T", [4, 1], [5, 1], [6, 1], [5, 2]);
  const Spiece = createPiece("S", [5, 1], [6, 1], [4, 2], [5, 2]);
  const Zpiece = createPiece("Z", [4, 1], [5, 1], [5, 2], [6, 2]);
  // Construct pieces with blocks
  const storedPieces: Piece[] = [Opiece, Ipiece, Jpiece, Lpiece, Tpiece, Spiece, Zpiece];
  return storedPieces;
};

/** 
 * Sets ups the current state.
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
  pastPiece: Piece[],
  score: number,
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
  shape: string,
  static: boolean,
  cubeList: CubeProps[],
};

/** 
 * Create initial stored pieces
 */
const initialStoredPieces = preparePieces();  

const initialState: State = {
  gameEnd: false,
  gameGrid: Array.from(
    { length: Constants.GRID_HEIGHT },
    () => Array(Constants.GRID_WIDTH).fill(null)
  ),
  storedPieces: [...initialStoredPieces], // Clone the initial stored pieces
  currentPiece: getRandomPiece(initialStoredPieces), // Get a random piece from the initial stored pieces
  pastPiece: [],
  score: 0,
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
    currentPiece.cubeList.forEach(cubeProps => {
      cubeProps.x = String(Number(cubeProps.x) - Block.WIDTH);
    });
  }
  return {
    ...state,
    currentPiece: currentPiece,
  };
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
    currentPiece.cubeList.forEach(cubeProps => {
      cubeProps.x = String(Number(cubeProps.x) + Block.WIDTH);
    });
  }
  return {
    ...state,
    currentPiece: currentPiece,
  };
};

/**
 * Handles moving the current piece directly to the bottom position or until it meets another cube below it.
 *
 * @param {State} state - The current state of the game.
 * @returns {State} The updated state after moving the piece to the bottom position.
 */
const movePieceDown = (state: State): State => {
  let updatedPiece = state.currentPiece;
  // Keep descending the piece until it can't descend anymore
  while (!isCollisionDown(updatedPiece, state.gameGrid)) {
    updatedPiece = descend(updatedPiece, state.gameGrid);
  }
  return {
    ...state,
    currentPiece: updatedPiece,
  };
};

/**
 * Finds the lowest cubes in each column of a piece.
 * These cubes are the ones closest to the bottom of each column within the piece.
 *
 * @param piece The piece for which to find the lowest cubes.
 * @returns An array of CubeProps representing the lowest cubes in each column within the piece.
 */
const findLowestCubes = (piece: Piece): CubeProps[] => {
  const lowestCubes: CubeProps[] = []; // Initialize an empty array to store the lowest cubes for each column
  // Loop through each cube in the piece
  piece.cubeList.forEach(cubeProps => {
    const cubeX = Math.floor(Number(cubeProps.x) / Block.WIDTH); // Determine the column position of the cube
    const cubeY = Math.floor(Number(cubeProps.y) / Block.HEIGHT); // Determine the row position of the cube
    // Check if there's no lowest cube for this column yet or if the current cube is lower
    if (!lowestCubes[cubeX] || cubeY > Number(lowestCubes[cubeX].y) / Block.HEIGHT) {
      lowestCubes[cubeX] = cubeProps; // Place the lowest cube for this column in the array
    }
  });
  return lowestCubes; // Return the array containing the lowest cubes in each column within the piece
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
  // Find the lowest cubes in each column of the piece
  const lowestCubes = findLowestCubes(updatedPiece);
  // Check if the piece can descend
  const canDescend = lowestCubes.every(cubeProps => {
    const cubeX = Math.floor(Number(cubeProps.x) / Block.WIDTH);
    const lowestCubeY = Math.floor(Number(cubeProps.y) / Block.HEIGHT);
    // Check if there is an empty space below the lowest cube in the grid
    return (
      lowestCubeY < Constants.GRID_HEIGHT - 1 &&
      gameGrid[lowestCubeY + 1][cubeX] === null
    );
  });
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
 * Replaces the current piece with a random piece if it is static,
 * and adds the static current piece to the past pieces.
 *
 * @param currentState Current state
 * @returns Updated state
 */
const checkAndReplacePiece = (currentState: State) => {
  if (currentState.gameEnd === false) {
    if (currentState.currentPiece.static) {
      // Renew the list of stored pieces
      const updatedStoredPieces = preparePieces();
      // Generate a new random piece to replace the static current piece.
      const newPiece = getRandomPiece(currentState.storedPieces);
      // Add the static current piece to the past pieces.
      const updatedPastPieces = currentState.pastPiece.concat(currentState.currentPiece);
      // Return the updated state with the new list of stored pieces, new piece and updated past pieces.
      return {
        ...currentState,
        storedPieces: updatedStoredPieces,
        currentPiece: newPiece,
        pastPiece: updatedPastPieces,
      };
    }}
    // If the current piece is not static, return the unchanged state.
    return currentState;
};

/**
 * Increases the score for each filled row in the gameGrid.
 *
 * @param gameGrid The 2D array representing the current state of the game grid.
 * @param score The current score.
 * @returns The updated score.
 */
const increaseScoreForFilledRows = (gameGrid: CubeProps[][], score: number): number => {
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
  return updatedScore;
};

/**
 * Checks if the game is over by checking if any cube in the top row of the grid is filled.
 * @param gameGrid The 2D array representing the current state of the game grid.
 * @returns True if the game is over, false otherwise.
 */
const checkGameOver = (gameGrid: CubeProps[][]): boolean => {
  const topRow = gameGrid[0];
  const isGameOver = topRow.some(cubeProps => cubeProps !== null);
  return isGameOver;
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
  const updatedScore = increaseScoreForFilledRows(updatedGrid, s.score);
  // Check if the game is over using the checkGameOver function
  const gameEnd = checkGameOver(updatedGrid);
  // Create an updated state
  const updatedState: State = {
    ...s,
    gameGrid: updatedGrid,
    currentPiece: updatedPiece,
    gameEnd: gameEnd,
    score: updatedScore,
  };
  // Check and replace the piece if needed
  const stateAfterReplacement = checkAndReplacePiece(updatedState); 
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

  /** Observables */

  /** Determines the rate of time steps */
  const tick$ = interval(Constants.TICK_RATE_MS);

  /**
   * Renders the current state to the canvas.
   *
   * In MVC terms, this updates the View using the Model.
   *
   * @param s Current state
   */
  const render = (s: State) => {
    // Remove SVG elements rendered with past cubes in the current piece
    const existingElements = document.querySelectorAll(".cube");
    existingElements.forEach(element => element.remove());
    if (s.gameEnd === false) {
      // Render the current piece by creating and appending new SVG elements
      s.currentPiece.cubeList.forEach(cubeProps => {
        const cubeSvg = createSvgElement(
          svg.namespaceURI, "rect", { ...cubeProps }
        );
        cubeSvg.classList.add("cube"); // Add a class to identify the elements
        svg.appendChild(cubeSvg);
      });
    }
    // Render past pieces
    s.pastPiece.forEach(pastPiece => {
      pastPiece.cubeList.forEach(cubeProps => {
        const cubeSvg = createSvgElement(
          svg.namespaceURI, "rect", { ...cubeProps }
        );
        cubeSvg.classList.add("cube"); 
        svg.appendChild(cubeSvg);
      });
    });
  };

  const source$ = merge(
    tick$.pipe(map(() => (state: State) => tick(state))),
    left$.pipe(map(() => (state: State) => movePieceLeft(state))),
    right$.pipe(map(() => (state: State) => movePieceRight(state))),
    down$.pipe(map(() => (state: State) => movePieceDown(state)))
  ).pipe(
    scan((s: State, action: (s: State) => State) => action(s), initialState)
  );
  source$.subscribe((s: State) => {
    render(s);
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
