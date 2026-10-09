//Spalten, Karten, Drag-and-Drop

import { STAGES, state, loadApplications } from "./state.js";

export async function renderBoard(container) {
    container.replaceChildren();
    const h2 = document.createElement("h2");
    h2.textContent = "Board";
    container.appendChild(h2);

    const board = document.createElement("div");
    board.classList.add("board");
    container.appendChild(board);

    const columns = {};
    for (const stage of STAGES) {
        // Create a column for each stage
        const column = document.createElement("div");
        column.classList.add("column");
        column.dataset.stage = stage.value;

        // Create a heading for the column
        const heading = document.createElement("h3");
        heading.textContent = stage.label; //treats the label as text, not HTML, preventing XSS attacks
        column.appendChild(heading);

        // Create a container for the cards in the column
        const cardsContainer = document.createElement("div");
        cardsContainer.classList.add("cards-container");
        cardsContainer.setAttribute("aria-busy", "true"); // indicates that the content of the element is being updated and may change
        column.appendChild(cardsContainer);
        board.appendChild(column);

        columns[stage.value] = cardsContainer;
    }

    try {
        await loadApplications(); // Load applications from the API
        renderColumns(columns); // Render the cards in the columns
    } catch (err) {
        console.error("Error occurred while loading applications:", err);
        const errorMessage = document.createElement("p");
        errorMessage.textContent = "Failed to load applications. Please try again later.";
        container.appendChild(errorMessage);
    } finally {
        // Set aria-busy to false after loading is complete
        for (const stage of STAGES) {
            columns[stage.value].setAttribute("aria-busy", "false");
        }
    }
}

function renderColumns(columns) {
    for (const stage of STAGES) {
        columns[stage.value].replaceChildren(); // Clear existing cards in the column
    }
    for (const app of state.applications) {
        columns[app.stage].appendChild(renderCard(app)); // Append the card to the appropriate column based on its stage
    }
    for (const stage of STAGES) {
        if (columns[stage.value].children.length === 0) {
            const emptyMessage = document.createElement("p");
            emptyMessage.textContent = "No applications in this stage.";
            columns[stage.value].appendChild(emptyMessage);
        }
    }
}

function renderCard(application) {
    const card = document.createElement("div");
    card.classList.add("card");
    card.dataset.applicationId = application.id;

    const company_name = document.createElement("strong");
    company_name.textContent = application.company_name;
    card.appendChild(company_name);

    const role_title = document.createElement("p");
    role_title.textContent = application.role_title;
    card.appendChild(role_title);

    const priority = document.createElement("p");
    priority.textContent = `Priority: ${application.priority}`;
    card.appendChild(priority);

    if (application.deadline) {
        const deadline = document.createElement("p");
        deadline.textContent = `Deadline: ${application.deadline}`;

        const today = new Date().toISOString().slice(0, 10); // Get today's date in YYYY-MM-DD format
        if (application.deadline < today) {
            const warning = document.createElement("span");
            warning.textContent = "Overdue";
            warning.className = "badge-overdue"; // Add a class for styling
            deadline.appendChild(warning);
        }
        card.appendChild(deadline);
    }
    return card;
}