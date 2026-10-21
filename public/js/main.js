import { showView, showNavigation } from "./views.js";
import { get, post } from "./api.js";
import { state } from "./state.js";
import { showToast } from "./toast.js";

const errorBanner = document.getElementById("error-banner");

async function start() {
  // remove an old error message (needed after clicking "Retry")
  errorBanner.replaceChildren();
  errorBanner.classList.remove("error-banner");

  try {
    state.user = await get("/api/auth/me");
    showNavigation(); // logged in -> board
  } catch (err) {
    if (err.status === 401) {
      showView("login"); // not logged in
    } else {
      showStartError(err); // server not reachable or broken
    }
  }
}

function showStartError(err) {
  console.error("Error occurred while loading user data:", err);

  const message = document.createElement("p");
  message.textContent = err.status === 0
    ? "Cannot reach the server. Please check your connection and try again."
    : "Something went wrong on the server. Please try again.";

  const retryBtn = document.createElement("button");
  retryBtn.type = "button";
  retryBtn.textContent = "Retry";
  retryBtn.addEventListener("click", start);

  errorBanner.classList.add("error-banner");
  errorBanner.replaceChildren(message, retryBtn);
}

// back to the login page (after logout or when the session has ended)
function showLoggedOut() {
  state.user = null;
  // close open dialogs, otherwise they would stay on top of the login page
  document.querySelectorAll("#modal-root dialog").forEach((dialog) => dialog.close());
  document.getElementById("nav-admin").hidden = true;
  document.getElementById("main-nav").hidden = true;
  showView("login");
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

async function logout() {
  try {
    await post("/api/auth/logout");
    showLoggedOut();
  } catch (err) {
    console.error("Error occurred during logout:", err);
    showToast("Logout failed. Please try again.");
  }
}
document.getElementById("logout-btn").addEventListener("click", logout);

// api.js fires this event when the server answers 401 (session expired or an admin disabled this account)
window.addEventListener("unauthorized", () => {
  if (!state.user) {
    return; // already logged out, e.g. a second request also got 401
  }
  showLoggedOut();
  showToast("Your session has ended. Please log in again.");
});

start();