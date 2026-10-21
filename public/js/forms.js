//Formulare und Validierung
import { state } from "./state.js";
import { post } from "./api.js";
import { setFieldError } from "./dialog.js";

export function renderLogin(container, onLoginSuccess) {
    container.replaceChildren(); // clear the container otherwise the form will be appended multiple times
    const h2 = document.createElement("h2");
    h2.textContent = "Login";
    container.appendChild(h2);

    const form = document.createElement("form");
    form.noValidate = true; // disable native HTML5 validation
    container.appendChild(form);

    const formError = document.createElement("p");
    formError.id = "login-form-error";
    formError.setAttribute("role", "alert");
    form.appendChild(formError);

    const usernameLabel = document.createElement("label");
    usernameLabel.htmlFor = "login-username";
    usernameLabel.textContent = "Username:";

    const usernameInput = document.createElement("input");
    usernameInput.id = "login-username"; //same for htmlFor and id to connect label and input
    usernameInput.name = "username";
    usernameInput.type = "text";
    usernameInput.required = true;

    const usernameError = document.createElement("small"); //small = automatically styled by pico
    usernameError.id = "login-username-error";
    usernameInput.setAttribute('aria.describedby', usernameError.id);

    form.append(usernameLabel, usernameInput, usernameError);

    const passwordLabel = document.createElement("label");
    passwordLabel.htmlFor = "login-password";
    passwordLabel.textContent = "Password:";

    const passwordInput = document.createElement("input");
    passwordInput.id = "login-password";
    passwordInput.name = "password";
    passwordInput.type = "password";
    passwordInput.required = true;

    const passwordError = document.createElement("small");
    passwordError.id = "login-password-error";

    passwordInput.setAttribute("aria-describedby", passwordError.id);

    form.append(passwordLabel, passwordInput, passwordError);

    const submitButton = document.createElement("button");
    submitButton.type = "submit";
    submitButton.textContent = "Login";
    form.appendChild(submitButton);

    const registerButton = document.createElement("button");
    registerButton.type = "button";
    registerButton.textContent = "Register";
    form.appendChild(registerButton);

    registerButton.addEventListener("click", () => {
        renderRegister(container, onLoginSuccess);
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault(); // prevent default form submission
        formError.textContent = "";
        setFieldError(usernameInput, usernameError, usernameInput.validity.valueMissing ? "Username is required." : "");
        setFieldError(passwordInput, passwordError, passwordInput.validity.valueMissing ? "Password is required." : "");

        if (!form.checkValidity()) {
            form.querySelector('[aria-invalid="true"]').focus(); // jump to the first empty field
            return;
        } else {
            submitButton.disabled = true; // Disable the button to prevent multiple submissions
            try {
                const user = await post("/api/auth/login", {
                    username: usernameInput.value.trim(),
                    password: passwordInput.value
                });
                state.user = user; // Update the state with the logged-in user
                onLoginSuccess(); // Call the callback function to handle successful login
                console.log("Login successful:", user);
            } catch (error) {
                if ((error.status === 400 || error.status === 409) && error.fieldErrors) {
                    setFieldError(usernameInput, usernameError, error.fieldErrors.username || "");
                    setFieldError(passwordInput, passwordError, error.fieldErrors.password || "");
                } else if (error.status === 0) {
                    formError.textContent = "Network error. Please check your connection.";
                } else {
                    formError.textContent = error.message || "An unknown error occurred.";
                }
                console.error("Login failed:", error);
            } finally {
                submitButton.disabled = false; // Re-enable the button after the request
            }
        }
    });
}

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/;
export function renderRegister(container, onRegisterSuccess) {
    container.replaceChildren(); // clear the container otherwise the form will be appended multiple times
    const h2 = document.createElement("h2");
    h2.textContent = "Register";
    container.appendChild(h2);

    const form = document.createElement("form");
    form.noValidate = true; // disable native HTML5 validation
    container.appendChild(form);

    const formError = document.createElement("p");
    formError.id = "register-form-error";
    formError.setAttribute("role", "alert");
    form.appendChild(formError);

    const usernameLabel = document.createElement("label");
    usernameLabel.htmlFor = "register-username";
    usernameLabel.textContent = "Username:";

    const usernameInput = document.createElement("input");
    usernameInput.id = "register-username"; //same for htmlFor and id to connect label and input
    usernameInput.name = "username";
    usernameInput.type = "text";
    usernameInput.required = true;

    const usernameError = document.createElement("small"); //small = automatically styled by pico
    usernameError.id = "register-username-error";
    usernameInput.setAttribute("aria-describedby", usernameError.id);

    form.append(usernameLabel, usernameInput, usernameError);

    const passwordLabel = document.createElement("label");
    passwordLabel.htmlFor = "register-password";
    passwordLabel.textContent = "Password:";

    const passwordInput = document.createElement("input");
    passwordInput.id = "register-password";
    passwordInput.name = "password";
    passwordInput.type = "password";
    passwordInput.required = true;

    const passwordError = document.createElement("small");
    passwordError.id = "register-password-error";
    passwordInput.setAttribute("aria-describedby", passwordError.id);

    form.append(passwordLabel, passwordInput, passwordError);

    const submitButton = document.createElement("button");
    submitButton.type = "submit";
    submitButton.textContent = "Register";
    form.appendChild(submitButton);

    form.addEventListener("submit", async (event) => {
        event.preventDefault(); // prevent default form submission
        formError.textContent = "";
        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        let usernameMessage = "";
        if (!username) {
            usernameMessage = "Username is required.";
        } else if (!USERNAME_PATTERN.test(username)) {
            usernameMessage = "Username must be 3–30 characters: letters, numbers or underscores only.";
        }

        let passwordMessage = "";
        if (!password) {
            passwordMessage = "Password is required.";
        } else if (password.length < 8) {
            passwordMessage = "Password must be at least 8 characters.";
        }

        setFieldError(usernameInput, usernameError, usernameMessage);
        setFieldError(passwordInput, passwordError, passwordMessage);

        if (usernameMessage || passwordMessage) {
            form.querySelector('[aria-invalid="true"]').focus(); // jump to the first wrong field
            return;
        }

        submitButton.disabled = true; // Disable the button to prevent multiple submissions
        try {
            await post("/api/auth/register", {
                username: username,
                password: password
            });
            const user = await post("/api/auth/login", {
                username: username,
                password: password
            });

            state.user = user;
            onRegisterSuccess(); // Call the callback function to handle successful registration

        } catch (error) {
            if ((error.status === 400 || error.status === 409) && error.fieldErrors) {
                setFieldError(usernameInput, usernameError, error.fieldErrors.username || "");
                setFieldError(passwordInput, passwordError, error.fieldErrors.password || "");
            } else if (error.status === 0) {
                formError.textContent = "Network error. Please check your connection.";
            } else {
                formError.textContent = error.message || "An unknown error occurred.";
            }
            console.error("Registration failed:", error);
        } finally {
            submitButton.disabled = false; // Re-enable the button after the request
        }
    });

    const backButton = document.createElement("button");
    backButton.type = "button";
    backButton.textContent = "Back to Login";
    form.appendChild(backButton);

    backButton.addEventListener("click", () => {
        renderLogin(container, onRegisterSuccess);
    });
}