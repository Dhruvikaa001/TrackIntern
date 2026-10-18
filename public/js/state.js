//Daten im Speicher (User, Applications)

import { get, patch, del } from "./api.js";

export const state = {
    user: null,
    applications: [],
    currentApplication: null
};

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