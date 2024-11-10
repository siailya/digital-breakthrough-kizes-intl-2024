import axios from 'axios';

export const BACKEND_URL = import.meta.env.PROD ? 'https://sleep.flint3s.ru/api' : 'http://localhost:3000/api';

export const apiInstance = axios.create({
  baseURL: BACKEND_URL,
});