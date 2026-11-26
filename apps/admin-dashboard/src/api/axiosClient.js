import axios from "axios";

const axiosClient = axios.create({
  baseURL: "/api",
  timeout: 10000,
  withCredentials: true
});

axiosClient.interceptors.response.use(response => response, error => {
  const requestUrl = String(error.config?.url || "");
  if (
    error.response?.status === 401 &&
    !requestUrl.includes("/admin/auth/") &&
    window.location.pathname !== "/login"
  ) {
    window.location.assign("/login");
  }
  return Promise.reject(error);
});

export default axiosClient;
