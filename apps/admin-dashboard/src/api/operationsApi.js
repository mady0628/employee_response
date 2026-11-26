import axiosClient from "./axiosClient";

const base = "/admin/ops";

export const operationsApi = {
  async overview(days = 7) {
    return (await axiosClient.get(`${base}/overview`, { params: { days } })).data.data;
  },
  async listSlas(params = {}) {
    return (await axiosClient.get(`${base}/slas`, { params })).data.data;
  },
  async report(days = 14) {
    return (await axiosClient.get(`${base}/reports/daily`, { params: { days } })).data.data;
  },
  async responseTimeReport(params = {}) {
    return (await axiosClient.get(`${base}/reports/response-time`, { params })).data.data;
  },
  async employees(params = {}) {
    return (await axiosClient.get(`${base}/employees`, { params })).data.data;
  },
  async createEmployee(payload) {
    return (await axiosClient.post(`${base}/employees`, payload)).data.data;
  },
  async setEmployeeStatus(id, status) {
    return (await axiosClient.patch(`${base}/employees/${id}/status`, { status })).data.data;
  },
  async verificationCode(id) {
    return (await axiosClient.post(`${base}/employees/${id}/verification-code`)).data.data;
  },
  async onboardingVerificationCode() {
    return (await axiosClient.post(`${base}/verification-codes`)).data.data;
  },
  async groups() {
    return (await axiosClient.get(`${base}/groups`)).data.groups;
  },
  async setGroupStatus(id, status) {
    return (await axiosClient.patch(`${base}/groups/${id}/status`, { status })).data.data;
  },
  async settings() {
    const response = (await axiosClient.get(`${base}/settings`)).data;
    if (!response?.success || !response.data) {
      throw new Error(response?.message || "API cài đặt SLA không trả dữ liệu.");
    }
    return response.data;
  },
  async updateSettings(payload) {
    return (await axiosClient.put(`${base}/settings`, payload)).data.data;
  }
};
