import axios from 'axios';

export const termiiClient = axios.create({
    baseURL: process.env.TERMII_BASE_URL || 'https://api.ng.termii.com/api', /*'https://v3.api.termii.com',*/
    headers: {
        'Content-Type': 'application/json',
    },
});
