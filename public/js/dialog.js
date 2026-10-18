import { STAGES } from "./state.js";

export function openApplicationDialog() {
    const dialog = document.createElement('dialog');
    const heading = document.createElement('h2');
    heading.textContent = 'Add application';

    const form = document.createElement('form');
    form.noValidate = true;

    const companyLabel = document.createElement('label');
    companyLabel.htmlFor = 'app-company';
    companyLabel.textContent = 'Company:';

    const companyField = document.createElement('select');
    companyField.id = 'app-company';
    companyField.name = 'company_id';

    const companyPlaceholder = document.createElement('option');
    companyPlaceholder.value = '';
    companyPlaceholder.textContent = 'Choose a company';
    companyField.append(companyPlaceholder);

    const companyError = document.createElement('small');

    const roleLabel = document.createElement('label');
    roleLabel.htmlFor = 'app-role';
    roleLabel.textContent = 'Role Title:';

    const roleField = document.createElement('input');
    roleField.id = 'app-role';
    roleField.name = 'role_title';
    roleField.type = 'text';
    roleField.required = true;
    roleField.maxLength = 100;

    const roleError = document.createElement('small');

    const stageLabel = document.createElement('label');
    stageLabel.htmlFor = 'app-stage';
    stageLabel.textContent = 'Stage:';

    const stageField = document.createElement('select');
    stageField.id = 'app-stage';
    stageField.name = 'stage';
    for (const s of STAGES) {
        const option = document.createElement('option');
        option.value = s.value;
        option.textContent = s.label;
        stageField.append(option);
    }
    stageField.value = 'wishlist';

    const stageError = document.createElement('small');

    const priorityLabel = document.createElement('label');
    priorityLabel.htmlFor = 'app-priority';
    priorityLabel.textContent = 'Priority:';

    const priorityField = document.createElement('select');
    priorityField.id = 'app-priority';
    priorityField.name = 'priority';
    for (const p of ['low', 'medium', 'high']) {
        const option = document.createElement('option');
        option.value = p;
        option.textContent = p;
        priorityField.append(option);
    }
    priorityField.value = 'medium';

    const priorityError = document.createElement('small');

    const deadlineLabel = document.createElement('label');
    deadlineLabel.htmlFor = 'app-deadline';
    deadlineLabel.textContent = 'Deadline:';

    const deadlineField = document.createElement('input');
    deadlineField.id = 'app-deadline';
    deadlineField.name = 'deadline';
    deadlineField.type = 'date';
    deadlineField.required = false;

    const deadlineError = document.createElement('small');

    const linkLabel = document.createElement('label');
    linkLabel.htmlFor = 'app-link';
    linkLabel.textContent = 'Link:';

    const linkField = document.createElement('input');
    linkField.id = 'app-link';
    linkField.name = 'link';
    linkField.type = 'url';
    linkField.required = false;

    const linkError = document.createElement('small');

    const notesLabel = document.createElement('label');
    notesLabel.htmlFor = 'app-notes';
    notesLabel.textContent = 'Notes:';

    const notesArea = document.createElement('textarea');
    notesArea.id = 'app-notes';
    notesArea.name = 'notes';
    notesArea.required = false;
    notesArea.maxLength = 2000;
    const notesError = document.createElement('small');

    form.append(companyLabel, companyField, companyError, roleLabel, roleField, roleError, stageLabel, stageField, stageError, priorityLabel, priorityField, priorityError, deadlineLabel, deadlineField, deadlineError, linkLabel, linkField, linkError, notesLabel, notesArea, notesError);

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.type = 'button';
    cancelBtn.addEventListener('click', function () {
        dialog.close();
    });

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.type = 'submit';

    form.append(cancelBtn, saveBtn);

    const article = document.createElement('article');
    article.append(heading, form);
    dialog.append(article);

    const modalRoot = document.querySelector('#modal-root');
    modalRoot.append(dialog);
    dialog.showModal();
    dialog.addEventListener('close', function () {
        dialog.remove();
    });
}