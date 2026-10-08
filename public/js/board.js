//Spalten, Karten, Drag-and-Drop

export function renderBoard(container) {
    container.replaceChildren();
    const h2 = document.createElement("h2");
    h2.textContent = "Board";
    container.appendChild(h2);
}
