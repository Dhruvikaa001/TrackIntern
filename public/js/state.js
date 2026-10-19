//Daten im Speicher (User, Applications)

import { get, patch, del } from "./api.js";

export const state = {
    user: null,
    applications: [],
    currentApplication: null
};

export const filters = {
    q: '',
    priority: '',
    sort: 'default'
};

export function getVisibleApplication() {
    //copy array so that the state does not change
    let list = [...state.applications];
    const query = filters.q.trim().toLowerCase();
    //if there is a search text only company and role stay
    if (query !== '') {
        list = list.filter((a) =>
            a.company_name.toLowerCase().includes(query) ||
            a.role_title.toLowerCase().includes(query)
        );
    }
    //if there is a prio only that one stays
    if (filters.priority !== '') {
        list = list.filter((a) => a.priority === filters.priority);
    }
    //sort by deadline or company name
    if (filters.sort === 'deadline') {
        list.sort((a, b) => (a.deadline || '9999-12-31').localeCompare(b.deadline || '9999-12-31'));
    } else if (filters.sort === 'company') {
        list.sort((a, b) => a.company_name.localeCompare(b.company_name));
    }

    return list;
}

export const STAGES = [
    { value: "wishlist", label: "Wishlist" },
    { value: "applied", label: "Applied" },
    { value: "oa", label: "Online Assessment" },
    { value: "interview", label: "Interview" },
    { value: "offer", label: "Offer" },
    { value: "rejected", label: "Rejected" }
];

export async function loadApplications() {
    const applications = await get("/api/applications");
    state.applications = applications;
}

export async function moveApplication(id, newStage) {
    const updated = await patch(`/api/applications/${id}/stage`, { stage: newStage });
    const index = state.applications.findIndex((a) => a.id === id);
    if (index !== -1) {
        state.applications[index] = updated;
    }
    return updated;
}

export async function deleteApplication(id) {
    await del(`/api/applications/${id}`);
    state.applications = state.applications.filter((a) => a.id !== id);
}