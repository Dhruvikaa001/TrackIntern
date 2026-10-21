// Admin-Ansicht
import { get, patch, del } from './api.js';
import { showToast } from './toast.js';
import { openConfirmDialog, openEditCompanyDialog } from './dialog.js';

export async function renderAdmin(container) {
    container.replaceChildren();

    const adminHeading = document.createElement('h2');
    adminHeading.textContent = 'Admin';

    const userSection = document.createElement('section');
    const userHeading = document.createElement('h3');
    userHeading.textContent = 'Users';
    userSection.append(userHeading);

    const companySection = document.createElement('section');
    const companyHeading = document.createElement('h3');
    companyHeading.textContent = 'Companies';
    companySection.append(companyHeading);

    container.append(adminHeading, userSection, companySection);

    await renderUsers(userSection, () => renderAdmin(container));
    await renderCompanies(companySection, () => renderAdmin(container));
}

async function renderUsers(userSection, onRetry) {
    const loadingInfo = document.createElement('p');
    loadingInfo.setAttribute('role', 'status');
    loadingInfo.textContent = 'Loading users...';
    userSection.append(loadingInfo);

    try {
        const users = await get('/api/admin/users');

        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        for (const title of ['Username', 'Role', 'Applications', 'Status', 'Action']) {
            const th = document.createElement('th');
            th.scope = 'col';
            th.textContent = title;
            headRow.append(th);
        }
        thead.append(headRow);

        const tbody = document.createElement('tbody');
        for (const user of users) {
            const row = document.createElement('tr');

            const nameCell = document.createElement('td');
            nameCell.textContent = user.username;

            const roleCell = document.createElement('td');
            roleCell.textContent = user.role;

            const countCell = document.createElement('td');
            countCell.textContent = user.app_count;

            const statusCell = document.createElement('td');

            const actionCell = document.createElement('td');
            const toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            actionCell.append(toggleBtn);

            const updateRow = () => {
                statusCell.textContent = user.is_active ? 'Active' : 'Disabled';
                toggleBtn.textContent = user.is_active ? 'Disable' : 'Enable';
            };
            updateRow();

            toggleBtn.addEventListener('click', async function () {
                toggleBtn.disabled = true;
                try {
                    await patch(`/api/admin/users/${user.id}`, { is_active: !user.is_active });
                    user.is_active = !user.is_active;
                    updateRow();
                    showToast(user.is_active ? 'User enabled' : 'User disabled');
                } catch (error) {
                    showToast(error.message);
                } finally {
                    toggleBtn.disabled = false;
                }
            });

            row.append(nameCell, roleCell, countCell, statusCell, actionCell);
            tbody.append(row);
        }

        table.append(thead, tbody);
        const wrapper = document.createElement('div');
        wrapper.classList.add('table-wrapper');
        wrapper.append(table);
        userSection.append(wrapper);

    } catch (error) {
        console.error('Error occurred while loading users:', error);

        const banner = document.createElement('div');
        banner.setAttribute('role', 'alert');
        banner.classList.add('error-banner');

        const message = document.createElement('p');
        message.textContent = error.status === 403
            ? 'You do not have access to this page.'
            : 'Could not load users. Please try again.';

        const retryBtn = document.createElement('button');
        retryBtn.type = 'button';
        retryBtn.textContent = 'Retry';
        retryBtn.addEventListener('click', onRetry);

        banner.append(message, retryBtn);
        userSection.append(banner);
    } finally {
        loadingInfo.remove();
    }
}

async function renderCompanies(companySection, onRetry) {
    const loadingInfo = document.createElement('p');
    loadingInfo.setAttribute('role', 'status');
    loadingInfo.textContent = 'Loading companies...';
    companySection.append(loadingInfo);

    try {
        const companies = await get('/api/admin/companies');
        companies.sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1));

        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        for (const title of ['Name', 'Industry', 'Submitted by', 'Applications', 'Status', 'Action']) {
            const th = document.createElement('th');
            th.scope = 'col';
            th.textContent = title;
            headRow.append(th);
        }
        thead.append(headRow);

        const tbody = document.createElement('tbody');
        for (const company of companies) {
            const row = document.createElement('tr');

            const nameCell = document.createElement('td');
            nameCell.textContent = company.name;

            const industryCell = document.createElement('td');
            industryCell.textContent = company.industry || '-';

            const submittedCell = document.createElement('td');
            submittedCell.textContent = company.created_by_username || '-';

            const applicationsCell = document.createElement('td');
            applicationsCell.textContent = company.app_count;

            const statusCell = document.createElement('td');
            statusCell.textContent = company.status === 'pending' ? 'Pending' : 'Approved';
            const actionCell = document.createElement('td');

            if (company.status === 'pending') {
                const approveBtn = document.createElement('button');
                approveBtn.type = 'button';
                approveBtn.textContent = 'Approve';
                approveBtn.addEventListener('click', async function () {
                    approveBtn.disabled = true;
                    try {
                        await patch(`/api/admin/companies/${company.id}`, { status: 'approved' });
                        company.status = 'approved';
                        statusCell.textContent = 'Approved';
                        approveBtn.remove();
                        showToast('Company approved');
                    } catch (error) {
                        approveBtn.disabled = false;
                        showToast(error.message);
                    }
                });
                actionCell.append(approveBtn);
            }

            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', function () {
                openEditCompanyDialog(company, (updated) => {
                    company.name = updated.name;
                    company.industry = updated.industry;
                    nameCell.textContent = updated.name;
                    industryCell.textContent = updated.industry || '–';
                });
            });
            actionCell.append(editBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', function () {
                openConfirmDialog(`Delete ${company.name}?`, async () => {
                    try {
                        await del(`/api/admin/companies/${company.id}`);
                        row.remove();
                        showToast('Company deleted');
                    } catch (error) {
                        showToast(error.message);
                    }
                });
            });
            actionCell.append(deleteBtn);

            row.append(nameCell, industryCell, submittedCell, applicationsCell, statusCell, actionCell);
            tbody.append(row);
        }

        table.append(thead, tbody);
        const wrapper = document.createElement('div');
        wrapper.classList.add('table-wrapper');
        wrapper.append(table);
        companySection.append(wrapper);

    } catch (error) {
        console.error('Error occurred while loading companies:', error);

        const banner = document.createElement('div');
        banner.setAttribute('role', 'alert');
        banner.classList.add('error-banner');

        const message = document.createElement('p');
        message.textContent = error.status === 403
            ? 'You do not have access to this page.'
            : 'Could not load companies. Please try again.';

        const retryBtn = document.createElement('button');
        retryBtn.type = 'button';
        retryBtn.textContent = 'Retry';
        retryBtn.addEventListener('click', onRetry);

        banner.append(message, retryBtn);
        companySection.append(banner);
    } finally {
        loadingInfo.remove();
    }
}
