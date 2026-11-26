import axiosClient from "./axiosClient";

export const connectionApi = {
  async getAll() {
    const response = await axiosClient.get("/admin/connections");
    return response.data.data;
  },

  async getTelegramBots() {
    const response = await axiosClient.get("/admin/connections/telegram");
    return response.data.data;
  },

  async createTelegramBot(payload) {
    const response = await axiosClient.post("/admin/connections/telegram", payload);
    return response.data.data;
  },

  async checkTelegramBot(id) {
    const response = await axiosClient.post(`/admin/connections/telegram/${id}/check`);
    return response.data.data;
  },

  async configureTelegramWebhook(id) {
    const response = await axiosClient.post(`/admin/connections/telegram/${id}/webhook`);
    return response.data.data;
  },

  async createWhatsApp(displayName) {
    const response = await axiosClient.post("/admin/connections/whatsapp", {
      displayName
    });
    return response.data.data;
  },

  async setDesiredState(id, desiredState) {
    const response = await axiosClient.patch(
      `/admin/connections/${id}/desired-state`,
      { desiredState }
    );
    return response.data.data;
  },

  async start(id) {
    const response = await axiosClient.post(
      `/admin/connections/${id}/start`
    );
    return response.data.data;
  },

  async getRuntime(id) {
    const response = await axiosClient.get(
      `/admin/connections/${id}/runtime`
    );
    return response.data.data;
  },

  async stop(id) {
    const response = await axiosClient.post(
      `/admin/connections/${id}/stop`
    );
    return response.data;
  },

  async logout(id) {
    const response = await axiosClient.post(
      `/admin/connections/${id}/logout`
    );
    return response.data;
  }
};
