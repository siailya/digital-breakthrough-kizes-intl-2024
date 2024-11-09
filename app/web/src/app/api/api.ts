import axios from "axios";

export const BACKEND_URL = "http://localhost:3000/api";

export const apiInstance = axios.create({
  baseURL: BACKEND_URL,
});