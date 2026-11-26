import axiosClient from "./axiosClient";

export const groupApi = {
  getAll: params => axiosClient.get("/groups", { params }),
  getById: id => axiosClient.get(`/groups/${id}`),
  updateStatus: (id, status) => axiosClient.patch(`/groups/${id}/status`, { status })
};
