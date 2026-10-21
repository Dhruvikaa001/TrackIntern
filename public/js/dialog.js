import { STAGES, loadApplicationDetails, stageLabel } from "./state.js";
import { get, post, patch } from "./api.js";
import { showToast } from "./toast.js";

export async function openApplicationDialog(onSaved, application = null) {
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

    const suggestBtn = document.createElement('button');
    suggestBtn.type = 'button';
    suggestBtn.className = 'secondary';
    suggestBtn.textContent = 'Company not listed? Suggest it';
    suggestBtn.addEventListener('click', function () {
        openCompanyDialog((company) => {
            const option = document.createElement('option');
            option.value = company.id;
            option.textContent = `${company.name} (pending)`;
            companyField.append(option);
            companyField.value = company.id;
            setFieldError(companyField, companyError, '');
        });
    });

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

    form.append(companyLabel, companyField, companyError, suggestBtn, roleLabel, roleField, roleError, stageLabel, stageField, stageError, priorityLabel, priorityField, priorityError, deadlineLabel, deadlineField, deadlineError, linkLabel, linkField, linkError, notesLabel, notesArea, notesError);

    // connect every field with its error text, so screen readers read the error together with the field
    for (const [field, errorEl] of [[companyField, companyError], [roleField, roleError], [stageField, stageError], [priorityField, priorityError], [deadlineField, deadlineError], [linkField, linkError], [notesArea, notesError]]) {
        errorEl.id = `${field.id}-error`;
        field.setAttribute('aria-describedby', errorEl.id);
    }

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

    const formError = document.createElement('p');
    formError.setAttribute('role', 'alert');
    form.prepend(formError);

    function validateCompany() {
        // in edit mode the company cannot be changed, so there is nothing to check
        const message = application || companyField.value ? '' : 'Please choose a company.';
        setFieldError(companyField, companyError, message);
        return message === '';
    }

    function validateRole() {
        const value = roleField.value.trim();
        let message = '';
        if (!value) {
            message = 'Role title is required.';
        } else if (value.length > 100) {
            message = 'Role title can be at most 100 characters.';
        }
        setFieldError(roleField, roleError, message);
        return message === '';
    }

    function validateDeadline() {
        // badInput = the user started typing a date but it is not complete/valid
        const message = deadlineField.validity.badInput ? 'Please enter a complete date.' : '';
        setFieldError(deadlineField, deadlineError, message);
        return message === '';
    }

    function validateLink() {
        const value = linkField.value.trim();
        let message = '';
        if (value) {
            try {
                const url = new URL(value);
                if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                    message = 'The link must start with http:// or https://';
                }
            } catch {
                message = 'Please enter a valid link, e.g. https://example.com';
            }
        }
        setFieldError(linkField, linkError, message);
        return message === '';
    }

    // live validation
    companyField.addEventListener('change', validateCompany);
    roleField.addEventListener('input', validateRole);
    deadlineField.addEventListener('change', validateDeadline);
    // a link is "invalid" while you are still typing it, so check it when leaving the field ...
    linkField.addEventListener('blur', validateLink);
    // ... but remove the error as soon as it is fixed
    linkField.addEventListener('input', function () {
        if (linkField.getAttribute('aria-invalid') === 'true') {
            validateLink();
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const body = {
            company_id: Number(companyField.value),
            role_title: roleField.value.trim(),
            stage: stageField.value,
            priority: priorityField.value,
            deadline: deadlineField.value || null,
            link: linkField.value.trim() || null,
            notes: notesArea.value
        };

        const errorFields = {
            company_id: companyError,
            role_title: roleError,
            stage: stageError,
            priority: priorityError,
            deadline: deadlineError,
            link: linkError,
            notes: notesError
        };

        formError.textContent = '';
        for (const [name, el] of Object.entries(errorFields)) {
            setFieldError(form.elements[name], el, '');
        }

        // run all checks, so every error is shown at once
        const results = [validateCompany(), validateRole(), validateDeadline(), validateLink()];
        if (results.includes(false)) {
            form.querySelector('[aria-invalid="true"]').focus(); // jump to the first wrong field
            return;
        }

        saveBtn.disabled = true;
        try {
            if (application) {
                delete body.company_id;
                delete body.stage;
                await patch(`/api/applications/${application.id}`, body);
                showToast('Application updated');
            } else {
                await post('/api/applications', body);
                showToast('Application saved');
            }
            dialog.close();
            onSaved();
        } catch (error) {
            if (error.fieldErrors) {
                for (const [name, message] of Object.entries(error.fieldErrors)) {
                    if (errorFields[name]) {
                        setFieldError(form.elements[name], errorFields[name], message);
                    } else {
                        formError.textContent = message;
                    }
                }
            } else if (error.status === 0) {
                formError.textContent = 'Network error. Please check your connection.';
            } else {
                formError.textContent = error.message || 'An unknown error occurred.';
            }
        } finally {
            saveBtn.disabled = false;
        }
    });

    const article = document.createElement('article');
    article.append(heading, form);
    dialog.append(article);

    if (application) {
        heading.textContent = 'Edit application';
        roleField.value = application.role_title;
        priorityField.value = application.priority;
        deadlineField.value = application.deadline ?? '';
        linkField.value = application.link ?? '';
        notesArea.value = application.notes ?? '';
        companyField.disabled = true;
        stageLabel.hidden = true;
        stageField.hidden = true;
        suggestBtn.hidden = true;
    }

    const modalRoot = document.querySelector('#modal-root');
    modalRoot.append(dialog);
    dialog.showModal();
    dialog.addEventListener('close', function () {
        dialog.remove();
    });

    companyPlaceholder.textContent = 'Loading companies...';
    try {
        const companies = await get('/api/companies');
        for (const company of companies) {
            const option = document.createElement('option');
            option.value = company.id;
            option.textContent = company.name;
            companyField.append(option);
        }
        companyPlaceholder.textContent = 'Choose a company';

        if (application) {
            companyField.value = application.company_id;
        }

    } catch (error) {
        companyPlaceholder.textContent = 'Choose a company';
        companyError.textContent = 'Could not load companies. Please try again.';
    }

}

export function openConfirmDialog(message, onConfirm) {
    const dialog = document.createElement('dialog');
    const article = document.createElement('article');

    const paragraph = document.createElement('p');
    paragraph.textContent = message;

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.autofocus = true;
    cancelBtn.addEventListener('click', function () {
        dialog.close();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', async function () {
        deleteBtn.disabled = true;
        await onConfirm();
        dialog.close();
    });

    article.append(paragraph, cancelBtn, deleteBtn);
    dialog.append(article);

    const modalRoot = document.querySelector('#modal-root');
    modalRoot.append(dialog);
    dialog.showModal();
    dialog.addEventListener('close', function () {
        dialog.remove();
    });
}

export function openCompanyDialog(onCreated) {
    const dialog = document.createElement('dialog');
    const heading = document.createElement('h2');
    heading.textContent = 'Suggest a company';

    const form = document.createElement('form');
    form.noValidate = true;

    const nameLabel = document.createElement('label');
    nameLabel.htmlFor = 'company-name';
    nameLabel.textContent = 'Company name:';

    const nameField = document.createElement('input');
    nameField.id = 'company-name';
    nameField.name = 'name';
    nameField.type = 'text';
    nameField.required = true;
    nameField.maxLength = 80;

    const nameError = document.createElement('small');

    const industryLabel = document.createElement('label');
    industryLabel.htmlFor = 'company-industry';
    industryLabel.textContent = 'Industry (optional):';

    const industryField = document.createElement('input');
    industryField.id = 'company-industry';
    industryField.name = 'industry';
    industryField.type = 'text';
    industryField.maxLength = 100;

    const industryError = document.createElement('small');

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.type = 'button';
    cancelBtn.addEventListener('click', function () {
        dialog.close();
    });

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.type = 'submit';

    const formError = document.createElement('p');
    formError.setAttribute('role', 'alert');

    form.append(formError, nameLabel, nameField, nameError, industryLabel, industryField, industryError, cancelBtn, saveBtn);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const body = {
            name: nameField.value.trim(),
            industry: industryField.value.trim() || null
        };

        const errorFields = {
            name: nameError,
            industry: industryError
        };

        formError.textContent = '';
        for (const el of Object.values(errorFields)) {
            el.textContent = '';
        }

        if (body.name.length < 2) {
            nameError.textContent = 'Please enter a company name (at least 2 characters).';
            return;
        }

        saveBtn.disabled = true;
        try {
            const company = await post('/api/companies', body);
            dialog.close();
            showToast('Company suggested. An admin will review it.');
            onCreated(company);
        } catch (error) {
            if (error.fieldErrors) {
                for (const [field, message] of Object.entries(error.fieldErrors)) {
                    (errorFields[field] || formError).textContent = message;
                }
            } else if (error.status === 0) {
                formError.textContent = 'Network error. Please check your connection.';
            } else {
                formError.textContent = error.message || 'An unknown error occurred.';
            }
        } finally {
            saveBtn.disabled = false;
        }
    });

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

export async function openDetailDialog(application) {
    const dialog = document.createElement('dialog');
    const article = document.createElement('article');

    const heading = document.createElement('h2');
    heading.textContent = `${application.company_name}: ${application.role_title}`;

    const content = document.createElement('div');
    const loading = document.createElement('p');
    loading.setAttribute('role', 'status');
    loading.textContent = 'Loading details...'
    content.append(loading);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', function () {
        dialog.close();
    });

    article.append(heading, content, closeBtn);
    dialog.append(article);
    document.querySelector('#modal-root').append(dialog);
    dialog.showModal();
    dialog.addEventListener('close', function () {
        dialog.remove();
    });

    try {
        const details = await loadApplicationDetails(application.id);
        content.replaceChildren(renderDetails(details), renderTimeline(details.history));
    } catch (error) {
        const message = document.createElement('p');
        message.setAttribute('role', 'alert');
        message.textContent = error.status === 404
            ? 'This application no longer exists.'
            : 'Could not load the details. Please try again.';
        content.replaceChildren(message);
    }
}

function renderDetails(details) {
    const list = document.createElement('dl');
    const rows = [
        ['Stage', stageLabel(details.stage)],
        ['Priority', details.priority],
        ['Deadline', details.deadline || '-'],
        ['Notes', details.notes || '-']
    ];
    for (const [label, value] of rows) {
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = value;
        list.append(dt, dd);
    }

    if (details.link) {
        const dt = document.createElement('dt');
        dt.textContent = 'Link';
        const dd = document.createElement('dd');
        const a = document.createElement('a');
        a.href = details.link;
        a.textContent = details.link;
        a.target = '_blank';
        a.rel = 'noopener noreferrer'; // the new tab cannot access our page
        dd.append(a);
        list.append(dt, dd);
    }
    return list;
}

function renderTimeline(history) {
    const section = document.createElement('section');
    const h3 = document.createElement('h3');
    h3.textContent = 'Timeline';

    const list = document.createElement('ol');
    list.classList.add('timeline');
    for (const entry of history) {
        const item = document.createElement('li');

        const text = document.createElement('span');
        text.textContent = entry.from_stage === null
            ? `Added to ${stageLabel(entry.to_stage)}`
            : `${stageLabel(entry.from_stage)} → ${stageLabel(entry.to_stage)}`;

        const time = document.createElement('time');
        time.dateTime = entry.changed_at; // machine-readable date for screen readers
        time.textContent = new Date(entry.changed_at).toLocaleString('en-GB', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });

        item.append(text, time);
        list.append(item);
    }
    section.append(h3, list);
    return section;
}

// shows or removes the error text under a field;
// aria-invalid tells screen readers the field is wrong (and Pico draws a red border)
function setFieldError(field, errorEl, message) {
    errorEl.textContent = message;
    if (message) {
        field.setAttribute('aria-invalid', 'true');
    } else {
        field.removeAttribute('aria-invalid');
    }
}