const board = document.getElementById("board");
const rowsInput = document.getElementById("rows");
const colsInput = document.getElementById("cols");
const createMainBtn = document.getElementById("createGrid");

const pieceRowsInput = document.getElementById("pieceRows");
const pieceColsInput = document.getElementById("pieceCols");
const addPieceBtn = document.getElementById("addPiece");
const pieceList = document.getElementById("pieceList");

const CELL_SIZE = 30;

let mainRows = 0;
let mainCols = 0;

// occupancy[r][c] = null or pieceId
let occupancy = [];

// placed pieces: id -> { id, pr, pc, r, c, el }
const placedPieces = new Map();
let pieceIdSeq = 1;

// drag state
let drag = null;
// drag = {
//   source: "sidebar" | "placed",
//   id: string | null,
//   pr, pc,
//   ghostEl,
//   offsetX, offsetY,
//   original: { r, c } | null
// }

createMainBtn.addEventListener("click", createMainGrid);
addPieceBtn.addEventListener("click", addPiece);

// start
createMainGrid();

function createMainGrid() {
  mainRows = Number(rowsInput.value);
  mainCols = Number(colsInput.value);

  // clear board completely (cells + placed pieces)
  board.innerHTML = "";

  // set grid columns
  board.style.gridTemplateColumns = `repeat(${mainCols}, ${CELL_SIZE}px)`;

  // data
  occupancy = Array.from({ length: mainRows }, () => Array(mainCols).fill(null));
  placedPieces.clear();

  // draw cells
  for (let r = 0; r < mainRows; r++) {
    for (let c = 0; c < mainCols; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      board.appendChild(cell);
    }
  }
}

function addPiece() {
  const pr = Number(pieceRowsInput.value);
  const pc = Number(pieceColsInput.value);

  const item = document.createElement("div");
  item.className = "pieceItem";

  // header with label + remove button
  const header = document.createElement("div");
  header.className = "pieceHeader";

  const label = document.createElement("div");
  label.textContent = `${pr}×${pc}`;

  const removeBtn = document.createElement("button");
  removeBtn.className = "removeBtn";
  removeBtn.type = "button";
  removeBtn.textContent = "×";
  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    item.remove();
  });

  header.appendChild(label);
  header.appendChild(removeBtn);

  // piece grid
  const pieceGrid = document.createElement("div");
  pieceGrid.className = "pieceGrid";
  pieceGrid.dataset.pr = String(pr);
  pieceGrid.dataset.pc = String(pc);
  pieceGrid.style.gridTemplateColumns = `repeat(${pc}, ${CELL_SIZE}px)`;

  for (let r = 0; r < pr; r++) {
    for (let c = 0; c < pc; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      pieceGrid.appendChild(cell);
    }
  }

  // drag from sidebar
  pieceGrid.addEventListener("pointerdown", (e) => {
    startDragFromSidebar(e, pr, pc);
  });

  item.appendChild(header);
  item.appendChild(pieceGrid);
  pieceList.prepend(item);
}

function startDragFromSidebar(e, pr, pc) {
  // if user clicked a button, do not drag
  if (e.target && e.target.closest && e.target.closest("button")) return;

  e.preventDefault();

  const ghostEl = createGhost(pr, pc);

  drag = {
    source: "sidebar",
    id: null,
    pr, pc,
    ghostEl,
    offsetX: 0,
    offsetY: 0,
    original: null
  };

  document.addEventListener("pointermove", onDragMove, { passive: false });
  document.addEventListener("pointerup", onDragEnd, { passive: false });
}

function startDragPlaced(e, id) {
  // if user clicked remove button, do not drag
  if (e.target && e.target.closest && e.target.closest("button")) return;

  e.preventDefault();

  const p = placedPieces.get(id);
  if (!p) return;

  const rect = p.el.getBoundingClientRect();
  const offsetX = e.clientX - rect.left;
  const offsetY = e.clientY - rect.top;

  // temporarily clear occupancy for this piece while moving
  setOccupancyForPiece(id, p.r, p.c, p.pr, p.pc, null);

  const ghostEl = createGhost(p.pr, p.pc);

  drag = {
    source: "placed",
    id,
    pr: p.pr,
    pc: p.pc,
    ghostEl,
    offsetX,
    offsetY,
    original: { r: p.r, c: p.c }
  };

  document.addEventListener("pointermove", onDragMove, { passive: false });
  document.addEventListener("pointerup", onDragEnd, { passive: false });
}

function createGhost(pr, pc) {
  const ghostEl = document.createElement("div");
  ghostEl.className = "ghost";
  ghostEl.style.width = `${pc * CELL_SIZE}px`;
  ghostEl.style.height = `${pr * CELL_SIZE}px`;
  board.appendChild(ghostEl);
  return ghostEl;
}

function onDragMove(e) {
  if (!drag) return;
  e.preventDefault();

  const { r, c } = pointerToCell(e.clientX, e.clientY, drag);

  drag.ghostEl.style.left = `${c * CELL_SIZE}px`;
  drag.ghostEl.style.top = `${r * CELL_SIZE}px`;

  const ok = canPlace(r, c, drag.pr, drag.pc, drag.id);
  drag.ghostEl.style.borderColor = ok ? "#50FF50" : "#ff5050";
}

function onDragEnd(e) {
  if (!drag) return;
  e.preventDefault();

  const { r, c } = pointerToCell(e.clientX, e.clientY, drag);
  const ok = canPlace(r, c, drag.pr, drag.pc, drag.id);

  if (drag.source === "sidebar") {
    if (ok) {
      placeNewPiece(r, c, drag.pr, drag.pc);
    }
  } else if (drag.source === "placed") {
    const id = drag.id;
    const p = placedPieces.get(id);

    if (ok) {
      p.r = r;
      p.c = c;
      p.el.style.left = `${c * CELL_SIZE}px`;
      p.el.style.top = `${r * CELL_SIZE}px`;
      setOccupancyForPiece(id, r, c, p.pr, p.pc, id);
    } else {
      // revert
      p.r = drag.original.r;
      p.c = drag.original.c;
      p.el.style.left = `${p.c * CELL_SIZE}px`;
      p.el.style.top = `${p.r * CELL_SIZE}px`;
      setOccupancyForPiece(id, p.r, p.c, p.pr, p.pc, id);
    }
  }

  drag.ghostEl.remove();
  drag = null;

  document.removeEventListener("pointermove", onDragMove);
  document.removeEventListener("pointerup", onDragEnd);
}

function pointerToCell(clientX, clientY, dragState) {
  const rect = board.getBoundingClientRect();

  let x = clientX - rect.left;
  let y = clientY - rect.top;

  if (dragState && dragState.source === "placed") {
    x -= dragState.offsetX;
    y -= dragState.offsetY;
  }

  const c = Math.floor(x / CELL_SIZE);
  const r = Math.floor(y / CELL_SIZE);
  return { r, c };
}

function canPlace(r0, c0, pr, pc, ignoreId) {
  if (r0 < 0 || c0 < 0) return false;
  if (r0 + pr > mainRows) return false;
  if (c0 + pc > mainCols) return false;

  for (let r = r0; r < r0 + pr; r++) {
    for (let c = c0; c < c0 + pc; c++) {
      const occ = occupancy[r][c];
      if (occ !== null && occ !== ignoreId) return false;
    }
  }
  return true;
}

function setOccupancyForPiece(id, r0, c0, pr, pc, value) {
  for (let r = r0; r < r0 + pr; r++) {
    for (let c = c0; c < c0 + pc; c++) {
      occupancy[r][c] = value;
    }
  }
}

function removePlacedPiece(id) {
  const p = placedPieces.get(id);
  if (!p) return;

  // free grid cells
  setOccupancyForPiece(id, p.r, p.c, p.pr, p.pc, null);

  // remove element + record
  p.el.remove();
  placedPieces.delete(id);
}

function placeNewPiece(r0, c0, pr, pc) {
  const id = `p${pieceIdSeq++}`;

  setOccupancyForPiece(id, r0, c0, pr, pc, id);

  const placed = document.createElement("div");
  placed.className = "placedPiece";
  placed.dataset.id = id;
  placed.style.width = `${pc * CELL_SIZE}px`;
  placed.style.height = `${pr * CELL_SIZE}px`;
  placed.style.left = `${c0 * CELL_SIZE}px`;
  placed.style.top = `${r0 * CELL_SIZE}px`;

  // remove button on the placed piece
  const removeBtn = document.createElement("button");
  removeBtn.className = "removeBtn";
  removeBtn.type = "button";
  removeBtn.textContent = "×";
  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    removePlacedPiece(id);
  });

  placed.appendChild(removeBtn);

  // dragging the placed piece
  placed.addEventListener("pointerdown", (e) => {
    startDragPlaced(e, id);
  });

  board.appendChild(placed);
  placedPieces.set(id, { id, pr, pc, r: r0, c: c0, el: placed });
}
