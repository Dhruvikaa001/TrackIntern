//Startpunkt, die einzige Datei, die index.html lädt
import { showView, showNavigation } from "./views.js";
import { get, post, ApiError } from "./api.js";
import { state } from "./state.js";

const view = document.getElementById("view");
const nav = document.getElementById("main-nav");

try {
  state.user = await get("/api/auth/me");
  showNavigation(); // Startansicht, wenn der User eingeloggt ist
} catch (err) {
  if (err.status === 401) {
    showView("login"); // Startansicht, wenn der User nicht eingeloggt ist
  } else {
    //hier noch popup einfügen mit retry button
    console.log("Error occurred while loading user data");
    console.log(err);
  }
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

async function logout() {
  try {
    await post("/api/auth/logout");
    state.user = null; // Clear the user state after logout
    document.getElementById("nav-admin").hidden = true; // Hide the admin button after logout
    document.getElementById("main-nav").hidden = true; // Hide the navigation after logout
    showView("login");
  } catch (err) {
    console.error("Error occurred during logout:", err);
  }
}
document.getElementById("logout-btn").addEventListener("click", logout);