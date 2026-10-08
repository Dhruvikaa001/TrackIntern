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
    if(state.user && state.user.role === "admin") {
    document.getElementById("nav-admin").hidden = false;
    } else {
        document.getElementById("nav-admin").hidden = true;
    }
    showView("board"); // Show the board view for admin users
}