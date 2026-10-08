//Admin-Ansicht

export function renderAdmin(container) {
    container.replaceChildren();
    const h2 = document.createElement("h2");
    h2.textContent = "Admin";
    container.appendChild(h2);
}