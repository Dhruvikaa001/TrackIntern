//alle Anfragen an den Server (fetch)

// MOCK-START (zum Entfernen: diesen Block, den Block in request() und mock.js löschen)
import { mockRequest } from "./mock.js";
const USE_MOCK = true;
// MOCK-END

export class ApiError extends Error {
    constructor(status, message, fieldErrors = null) {
        super(message);
        this.status = status;
        this.fieldErrors = fieldErrors;
    }
}

async function request(method, url, body = null) {
      
    
    // MOCK-START
    if (USE_MOCK) {
        const result = await mockRequest(method, url, body);
        if (result.status >= 400) {
            const message = result.data?.error || `Request failed (${result.status})`;
            throw new ApiError(result.status, message, result.data?.errors);
        }
        return result.data;
    }
    // MOCK-END

    
    const options = {
        method: method,
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    let response;
    try {
        response = await fetch(url, options);
    } catch (error) {
        throw new ApiError(0, "Network error");
    }

    let data = null;
    if (response.status !== 204) { // No Content
        try {
            data = await response.json();
        } catch {
            data = null;
        }
    }

    if (!response.ok) {
        throw new ApiError(response.status, data?.error, data?.err);
    }
    
    return data;
}

export const get = (url) => request('GET', url);
export const post = (url, body) => request('POST', url, body);
export const patch = (url, body) => request('PATCH', url, body);
export const del = (url) => request('DELETE', url);