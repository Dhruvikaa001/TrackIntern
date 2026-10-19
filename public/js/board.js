//Spalten, Karten, Drag-and-Drop

import { STAGES, state, loadApplications, moveApplication, deleteApplication } from "./state.js";
import { openApplicationDialog, openConfirmDialog } from "./dialog.js";
import { showToast } from "./toast.js";

export async function renderBoard(container) {
    container.replaceChildren();
    const h2 = document.createElement("h2");
    h2.textContent = "Board";
    container.appendChild(h2);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = '+ Add application';
    container.append(addBtn);
    addBtn.addEventListener('click', function () {
        openApplicationDialog(() => renderBoard(container));
    });


    const board = document.createElement("div");
    board.classList.add("board");
    container.appendChild(board);

    const columns = {};
    for (const stage of STAGES) {
        // Create a column for each stage
        const column = document.createElement("div");
        column.classList.add("column");
        column.dataset.stage = stage.value;


        column.addEventListener('dragover', function (event) {
            event.preventDefault();
            column.classList.add('drag-over');
        });

        column.addEventListener('dragleave', function (event) {
            if (!column.contains(event.relatedTarget)) {
                column.classList.remove('drag-over');
            }
        });

        column.addEventListener('drop', function (event) {
            event.preventDefault();
            column.classList.remove('drag-over');
            const id = Number(event.dataTransfer.getData('text/plain'));
            handleDrop(id, column.dataset.stage, columns, () => renderBoard(container));
        });

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
        renderColumns(columns, () => renderBoard(container)); // Render the cards in the columns
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

async function handleDrop(id, newStage, columns, onReload) {
    const application = state.applications.find((a) => a.id === id);
    if (!application || application.stage === newStage) {
        return;
    }
    const oldStage = application.stage;
    application.stage = newStage;
    renderColumns(columns, onReload);

    try {
        await moveApplication(id, newStage);
        const label = STAGES.find((s) => s.value === newStage).label;
        renderColumns(columns, onReload);
        showToast(`Moved to ${label}`);
    } catch (error) {
        application.stage = oldStage;
        renderColumns(columns, onReload);
        showToast(error.message);
    }
}

function renderColumns(columns, onReload) {
    for (const stage of STAGES) {
        columns[stage.value].replaceChildren(); // Clear existing cards in the column
    }
    for (const app of state.applications) {
        columns[app.stage].appendChild(renderCard(app, () => renderColumns(columns, onReload), onReload));
    }
    for (const stage of STAGES) {
        const count = state.applications.filter((a) => a.stage === stage.value).length;
        columns[stage.value].parentElement.querySelector('h3').textContent = `${stage.label} (${count})`;
        if (columns[stage.value].children.length === 0) {
            const emptyMessage = document.createElement("p");
            emptyMessage.textContent = "No applications in this stage.";
            columns[stage.value].appendChild(emptyMessage);
        }
    }
}

function renderCard(application, onMove, onReload) {
    const card = document.createElement("div");
    card.classList.add("card");
    card.dataset.applicationId = application.id;
    card.draggable = true;

    card.addEventListener('dragstart', function (event) {
        event.dataTransfer.setData('text/plain', String(application.id));
        event.dataTransfer.effectAllowed = 'move';
        card.classList.add('dragging');
    });

    card.addEventListener('dragend', function (event) {
        card.classList.remove('dragging');
    });

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
        const inThreeDays = new Date();
        inThreeDays.setDate(inThreeDays.getDate() + 3);
        const soon = inThreeDays.toISOString().slice(0, 10);

        if (application.deadline < today) {
            const warning = document.createElement("span");
            warning.textContent = "Overdue";
            warning.className = "badge-overdue"; // Add a class for styling
            deadline.appendChild(warning);
        } else if (application.deadline <= soon) {
            const warning = document.createElement('span');
            warning.textContent = 'Due soon';
            warning.className = 'badge-soon';
            deadline.appendChild(warning);
        }
        card.appendChild(deadline);
    }

    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Move to stage');
    for (const stage of STAGES) {
        const option = document.createElement('option');
        option.value = stage.value;
        option.textContent = stage.label;
        select.append(option);
    }
    select.value = application.stage;
    card.append(select);

    select.addEventListener('change', async function () {
        try {
            await moveApplication(application.id, select.value);
            const label = STAGES.find((s) => s.value === select.value).label;
            onMove();
            showToast(`Moved to ${label}`);
        } catch (error) {
            select.value = application.stage;
            showToast(error.message);
        }
    });

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', function () {
        openApplicationDialog(onReload, application);
    });
    card.append(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', function () {
        openConfirmDialog(`Delete ${application.company_name}: ${application.role_title}?`, async () => {
            try {
                await deleteApplication(application.id);
                onMove();
                showToast('Application deleted');
            } catch (error) {
                showToast(error.message);
            }
        });
    });
    card.append(deleteBtn);
    return card;
}