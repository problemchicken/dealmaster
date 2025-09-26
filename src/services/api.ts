import axios, {AxiosRequestConfig} from 'axios';
import {useAuthStore} from '../store/useAuthStore';

declare const process: {
  env?: {
    API_URL?: string;
  };
};

const API_URL =
  typeof process !== 'undefined' && process.env?.API_URL
    ? process.env.API_URL
    : 'https://example.com/api';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 5000,
});

api.interceptors.request.use((config: AxiosRequestConfig) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  return config;
});

export type LoginPayload = {
  email: string;
  password: string;
};

export type LoginResponse = {
  token: string;
};

export const loginRequest = async (
  payload: LoginPayload,
): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/auth/login', payload);
  return response.data;
};
