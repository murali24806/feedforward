import axios from 'axios';

const API = axios.create({ baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api' });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('ff_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ff_token');
      localStorage.removeItem('ff_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const register = (data) => API.post('/auth/register', data);
export const login = (data) => API.post('/auth/login', data);

// Users
export const getProfile = () => API.get('/users/profile');
export const updateProfile = (data) => API.put('/users/profile', data);
export const getDonors = () => API.get('/users/donors');
export const getAgents = () => API.get('/users/agents');
export const getAdmins = () => API.get('/users/admins');
export const getUserById = (id) => API.get(`/users/${id}`);

// Food
export const postFood = (data) => API.post('/food/post', data);
export const getAllFood = () => API.get('/food/all');
export const getMyFood = () => API.get('/food/my');
export const getFoodById = (id) => API.get(`/food/${id}`);
export const acceptFood = (id, agentId, adminLocation) => API.put(`/food/${id}/accept`, { agentId, adminLocation });
export const rejectFood = (id) => API.put(`/food/${id}/reject`);

// Delivery
export const getMyDeliveries = () => API.get('/delivery/my');
export const getAllDeliveries = () => API.get('/delivery/all');
export const getDeliveryById = (id) => API.get(`/delivery/${id}`);
export const updateDeliveryStatus = (id, status) => API.put(`/delivery/${id}/status`, { status });
export const rejectDelivery = (id) => API.put(`/delivery/${id}/reject`);
export const removeDelivery = (id) => API.delete(`/delivery/${id}/remove`);
export const getDonorDeliveries = () => API.get('/delivery/donor/my');

// Points
export const assignPoints = (data) => API.post('/points/assign', data);
export const getMyPoints = () => API.get('/points/my');
export const getDonorPoints = (donorId) => API.get(`/points/${donorId}`);

export default API;
