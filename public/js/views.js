//View-Wechsel
import { renderLogin } from "./forms.js";
import { renderBoard } from "./board.js";
import { renderAdmin } from "./admin.js";
import { state } from "./state.js";

const view = document.getElementById("view");

export function showView(name) {

    switch (name) {
        case "login":
            renderLogin(view, () => {
                // After successful login, show the board view
                showNavigation();
            });
            break;
        case "board":
            renderBoard(view);
            break;
        case "admin":
            renderAdmin(view);
            break;
        default:
            console.error("Unknown view:", name);
    }
}

export function showNavigation() {
    document.getElementById("main-nav").hidden = false;
    // Board and Admin are only needed to switch between the two views,
    // so only admins see them (the server still checks every permission)
    const isAdmin = state.user && state.user.role === "admin";
    document.getElementById("nav-board").hidden = !isAdmin;
    document.getElementById("nav-admin").hidden = !isAdmin;
    showView("board"); // start page after login (for every user)
}