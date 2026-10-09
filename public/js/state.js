//Daten im Speicher (User, Applications)

import { get } from "./api.js";

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