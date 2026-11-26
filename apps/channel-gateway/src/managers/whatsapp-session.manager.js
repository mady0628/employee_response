const path = require("node:path");
const fs = require("node:fs/promises");
const { randomUUID } = require("node:crypto");
const { Client, LocalAuth } = require("whatsapp-web.js");

const SESSION_PATH = path.resolve(process.env.WHATSAPP_SESSION_PATH || ".wwebjs_auth");

class WhatsAppSessionManager {
  constructor({ onMessage, onReaction, onStatus, onGroupDiscovered }) {
    this.sessions = new Map();
    this.operations = new Map();
    this.onMessage = onMessage;
    this.onReaction = onReaction;
    this.onStatus = onStatus;
    this.onGroupDiscovered = onGroupDiscovered;
  }

  async withConnectionLock(connectionId, task) {
    const id = String(connectionId);
    const previous = this.operations.get(id) || Promise.resolve();

    const current = previous
      .catch(() => {})
      .then(task);

    const tracked = current
      .then(() => {}, () => {});

    this.operations.set(id, tracked);

    try {
      return await current;
    } finally {
      if (this.operations.get(id) === tracked) {
        this.operations.delete(id);
      }
    }
  }

  get(connectionId) {
    return this.sessions.get(String(connectionId));
  }

  getConnectedClient(connectionId) {
    const session = this.get(connectionId);
    if (!session || session.status !== "CONNECTED" || session.closing) {
      const error = new Error("WhatsApp connection is not ready");
      error.status = 503;
      throw error;
    }
    return session.client;
  }

  getStatus(connectionId) {
    const session = this.get(connectionId);
    if (!session) {
      return {
        status: "STOPPED",
        qr: null,
        accountId: null,
        runtimeInstanceId: null
      };
    }

    return {
      status: session.status,
      qr: session.qr,
      accountId: session.accountId,
      runtimeInstanceId: session.runtimeInstanceId
    };
  }

  async start(connectionId, generation = 1) {
    return this.withConnectionLock(connectionId, async () => {
      const id = String(connectionId);
      const { claimRuntime, heartbeatRuntime } = require("../clients/config.client");

      const existing = this.sessions.get(id);
      if (existing && !existing.closing) {
        if (
          existing.status === "CONNECTED" ||
          existing.status === "CONNECTING" ||
          existing.status === "QR_PENDING"
        ) {
          return this.getStatus(id);
        }
        existing.closing = true;
        clearInterval(existing.heartbeatTimer);
        try {
          await existing.client.destroy();
        } catch (error) {
          console.warn(`[WhatsApp Session Manager] Cleanup before restart failed for #${id}:`, error.message);
        }
        if (this.sessions.get(id) === existing) this.sessions.delete(id);
        if (typeof this.onStatus === "function") {
          await this.onStatus(id, "STOPPED", { runtimeInstanceId: existing.runtimeInstanceId }, existing.generation);
        }
      }

      const client = new Client({
        authStrategy: new LocalAuth({
          clientId: `wa_${id}_${generation}`,
          dataPath: SESSION_PATH
        }),
        puppeteer: {
          headless: true,
          args: [
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote"
          ]
        }
      });

      const runtimeInstanceId = randomUUID();
      await claimRuntime({ connectionId: id, generation, runtimeInstanceId });

      const session = {
        client,
        runtimeInstanceId,
        generation,
        status: "CONNECTING",
        closing: false,
        qr: null,
        accountId: null
      };

      this.sessions.set(id, session);

      const isCurrent = () =>
        this.sessions.get(id) === session && !session.closing;

      const updateStatus = async (status, details = {}) => {
        if (!isCurrent() && status !== "STOPPED" && status !== "LOGGED_OUT") return;
        session.status = status;
        try {
          if (typeof this.onStatus === "function") {
            await this.onStatus(id, status, {
              ...details,
              runtimeInstanceId: session.runtimeInstanceId
            }, generation);
          }
        } catch (error) {
          console.error(`[WhatsApp Session Manager] Cannot persist status for conn ${id}:`, error.message);
        }
      };

      await updateStatus("CONNECTING");

      client.on("qr", async qr => {
        if (!isCurrent()) return;
        session.qr = qr;
        console.log(`[WhatsApp Session Manager] QR generated for connection #${id}`);
        await updateStatus("QR_PENDING");
      });

      client.on("authenticated", async () => {
        if (!isCurrent()) return;
        session.qr = null;
        console.log(`[WhatsApp Session Manager] Connection #${id} authenticated`);
        await updateStatus("AUTHENTICATED");
      });

      client.on("ready", async () => {
        if (!isCurrent()) return;
        session.qr = null;
        session.accountId = client.info?.wid?._serialized || null;
        console.log(`[WhatsApp Session Manager] Connection #${id} READY! Account: ${session.accountId}`);

        await updateStatus("CONNECTED", {
          accountId: session.accountId
        });

        try {
          const chats = await client.getChats();
          for (const chat of chats) {
            if (!chat.isGroup) continue;
            if (typeof this.onGroupDiscovered === "function") {
              await this.onGroupDiscovered(
                id,
                chat.id._serialized,
                chat.name
              );
            }
          }
        } catch (error) {
          console.error(`[WhatsApp Session Manager] Group discovery error on #${id}:`, error.message);
        }
      });

      client.on("group_join", async notification => {
        if (!isCurrent()) return;
        try {
          const chat = await notification.getChat();
          if (!chat?.isGroup) return;
          if (typeof this.onGroupDiscovered === "function") {
            await this.onGroupDiscovered(
              id,
              chat.id._serialized,
              chat.name
            );
          }
        } catch (error) {
          console.error(`[WhatsApp Session Manager] group_join error on #${id}:`, error.message);
        }
      });

      client.on("auth_failure", async error => {
        if (!isCurrent()) return;
        session.qr = null;
        console.error(`[WhatsApp Session Manager] Auth failure on conn #${id}:`, error);
        clearInterval(session.heartbeatTimer);
        await updateStatus("ERROR", {
          error: String(error)
        });
        try {
          await client.destroy();
        } catch (destroyError) {
          console.warn(`[WhatsApp Session Manager] Auth failure cleanup for #${id}:`, destroyError.message);
        }
        if (this.sessions.get(id) === session) this.sessions.delete(id);
      });

      client.on("disconnected", async reason => {
        if (!isCurrent()) return;
        session.qr = null;
        console.warn(`[WhatsApp Session Manager] Conn #${id} disconnected:`, reason);
        await updateStatus("DISCONNECTED", {
          reason: String(reason)
        });
      });

      client.on("message_create", message => {
        if (!isCurrent()) return;
        if (session.status !== "CONNECTED") return;

        Promise.resolve(
          this.onMessage(id, client, message)
        ).catch(err => {
          console.error(`[WhatsApp Session Manager] Error in onMessage for conn #${id}:`, err.message);
        });
      });

      client.on("message_reaction", reaction => {
        if (!isCurrent()) return;
        if (session.status !== "CONNECTED") return;

        Promise.resolve(
          this.onReaction(id, reaction)
        ).catch(err => {
          console.error(`[WhatsApp Session Manager] Error in onReaction for conn #${id}:`, err.message);
        });
      });

      client.initialize().catch(async error => {
        console.error(`[WhatsApp Session Manager] Initialization failed on conn #${id}:`, error.message);
        if (isCurrent()) {
          await updateStatus("ERROR", {
            error: error.message
          });
        }

        try {
          await client.destroy();
        } catch (destroyError) {
          console.error(destroyError.message);
        }

        if (this.sessions.get(id) === session) {
          this.sessions.delete(id);
        }
        clearInterval(session.heartbeatTimer);
      });

      session.heartbeatTimer = setInterval(() => {
        heartbeatRuntime({
          connectionId: id,
          generation,
          runtimeInstanceId: session.runtimeInstanceId
        }).catch(error => {
          console.error(`[WhatsApp Session Manager] Heartbeat failed for conn #${id}:`, error.message);
        });
      }, 30000);
      session.heartbeatTimer.unref?.();

      return {
        status: "CONNECTING",
        runtimeInstanceId
      };
    });
  }

  async stop(connectionId) {
    return this.withConnectionLock(connectionId, async () => {
      const id = String(connectionId);
      const session = this.sessions.get(id);

      if (!session) {
        return { status: "STOPPED" };
      }

      session.closing = true;
      clearInterval(session.heartbeatTimer);
      session.status = "STOPPING";
      session.qr = null;

      try {
        await session.client.destroy();

        if (this.sessions.get(id) === session) {
          this.sessions.delete(id);
        }

        if (typeof this.onStatus === "function") {
          await this.onStatus(
            id,
            "STOPPED",
            {
              runtimeInstanceId: session.runtimeInstanceId
            },
            session.generation
          );
        }

        return { status: "STOPPED" };
      } catch (error) {
        session.status = "ERROR";

        if (typeof this.onStatus === "function") {
          await this.onStatus(
            id,
            "ERROR",
            {
              error: error.message,
              runtimeInstanceId: session.runtimeInstanceId
            },
            session.generation
          );
        }

        throw error;
      }
    });
  }

  async logout(connectionId, generation = 1) {
    return this.withConnectionLock(connectionId, async () => {
      const id = String(connectionId);
      const session = this.sessions.get(id);

      if (!session) {
        if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(generation)) || Number(generation) < 1) {
          throw new Error("Invalid WhatsApp connection identity");
        }
        const authDirectory = path.resolve(SESSION_PATH, `session-wa_${id}_${generation}`);
        if (!authDirectory.startsWith(`${SESSION_PATH}${path.sep}`)) {
          throw new Error("Invalid WhatsApp session path");
        }
        await fs.rm(authDirectory, { recursive: true, force: true, maxRetries: 4 });
        if (typeof this.onStatus === "function") {
          await this.onStatus(id, "LOGGED_OUT", {}, generation);
        }
        return { status: "LOGGED_OUT" };
      }

      session.closing = true;
      clearInterval(session.heartbeatTimer);
      session.status = "LOGGING_OUT";
      session.qr = null;

      try {
        await session.client.logout();

        try {
          await session.client.destroy();
        } catch (error) {
          console.error("Browser cleanup:", error.message);
        }

        if (this.sessions.get(id) === session) {
          this.sessions.delete(id);
        }

        if (typeof this.onStatus === "function") {
          await this.onStatus(
            id,
            "LOGGED_OUT",
            {
              runtimeInstanceId: session.runtimeInstanceId
            },
            session.generation
          );
        }

        return { status: "LOGGED_OUT" };
      } catch (error) {
        session.status = "ERROR";

        if (typeof this.onStatus === "function") {
          await this.onStatus(
            id,
            "ERROR",
            {
              error: error.message,
              runtimeInstanceId: session.runtimeInstanceId
            },
            session.generation
          );
        }

        throw error;
      }
    });
  }
}

module.exports = {
  WhatsAppSessionManager
};
