/**
 * Real-Time Chat WebSocket Manager (Backed by FastAPI + Redis Pub/Sub).
 *
 * Connects to: `wss://<host>/api/v1/chat/ws?token=<jwt_access_token>`
 *
 * Responsibilities:
 * - Single shared WebSocket connection per authenticated user session
 * - Heartbeat keepalive (`"ping"` -> `"pong"`) to detect half-open mobile sockets
 * - Bounded exponential backoff with jitter on disconnect
 * - Automatic JWT refresh via `apiFetch('/user/me')` when closed with 4001
 * - AppState foreground reconciliation so missed messages are recovered after
 *   Android/iOS background suspension
 * - Safe listener subscription & cleanup on logout or account switch
 */
import { AppState, type AppStateStatus } from 'react-native';
import { Config } from '@/constants/config';
import { getAccessToken } from './tokenStorage';
import { apiFetch } from './apiClient';
import { normalizeChatMessage } from './chatService';
import type { ChatConnectionState, ChatWsEvent } from '@/types/chat';

type ChatEventListener = (event: ChatWsEvent) => void;
type ConnectionStateListener = (state: ChatConnectionState) => void;
type ReconnectSyncListener = () => void;

const PING_INTERVAL_MS = 25_000;
const PONG_TIMEOUT_MS = 12_000;
const BASE_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;

function resolveWsBaseUrl(): string {
  const configured = Config.WS_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  const apiBase = Config.API_BASE_URL.trim().replace(/\/+$/, '');
  if (apiBase.startsWith('https://')) {
    return `wss://${apiBase.slice('https://'.length)}`;
  }
  if (apiBase.startsWith('http://')) {
    return `ws://${apiBase.slice('http://'.length)}`;
  }
  return apiBase;
}

function isJwtExpiredOrNearExpiry(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || typeof globalThis.atob !== 'function') {
      return false;
    }
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(globalThis.atob(base64)) as { exp?: number };
    if (typeof payload.exp !== 'number') return false;
    return payload.exp * 1000 <= Date.now() + 30_000;
  } catch {
    return false;
  }
}

class ChatSocketManager {
  private ws: WebSocket | null = null;
  private state: ChatConnectionState = 'idle';
  private activeUserId: string | null = null;
  private shouldStayConnected = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private pongTimeout: ReturnType<typeof setTimeout> | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private lastAppState: AppStateStatus = AppState.currentState;
  private lastSyncAt = 0;
  private isRefreshingToken = false;
  private hadConnectedOnce = false;

  private eventListeners = new Set<ChatEventListener>();
  private stateListeners = new Set<ConnectionStateListener>();
  private syncListeners = new Set<ReconnectSyncListener>();

  public getState(): ChatConnectionState {
    return this.state;
  }

  private setState(next: ChatConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    this.stateListeners.forEach((listener) => {
      try {
        listener(next);
      } catch {
        // Ignore subscriber errors
      }
    });
  }

  private notifySyncListeners(): void {
    const now = Date.now();
    if (now - this.lastSyncAt < 10_000) {
      return;
    }
    this.lastSyncAt = now;
    this.syncListeners.forEach((listener) => {
      try {
        listener();
      } catch {
        // Ignore subscriber errors
      }
    });
  }

  /**
   * Start or maintain the real-time WebSocket connection for the given user.
   */
  public async connect(userId: string): Promise<void> {
    if (!userId) return;

    // If switching users, tear down any previous socket first
    if (this.activeUserId && this.activeUserId !== userId) {
      this.disconnect();
    }

    this.activeUserId = userId;
    this.shouldStayConnected = true;
    this.ensureAppStateListener();

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    await this.openSocket();
  }

  /**
   * Cleanly close the WebSocket connection and stop all timers (e.g. on logout).
   */
  public disconnect(): void {
    this.shouldStayConnected = false;
    this.activeUserId = null;
    this.reconnectAttempts = 0;
    this.hadConnectedOnce = false;
    this.clearTimers();

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    if (this.ws) {
      const socket = this.ws;
      this.ws = null;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      try {
        socket.close(1000, 'Client disconnect');
      } catch {
        // Ignore close errors
      }
    }

    this.setState('idle');
  }

  /**
   * Force an immediate reconnection check and state sync (e.g. pull-to-refresh or retry).
   */
  public async reconnectNow(): Promise<void> {
    if (!this.shouldStayConnected || !this.activeUserId) return;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendRaw('ping');
      this.notifySyncListeners();
      return;
    }

    this.reconnectAttempts = 0;
    await this.openSocket();
  }

  /**
   * Send a typing indicator or custom JSON frame over the active WebSocket if connected.
   */
  public sendTyping(jobId: string, isTyping: boolean): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(
        JSON.stringify({
          type: 'typing',
          job_id: jobId,
          is_typing: isTyping,
        }),
      );
    } catch {
      // Non-critical if socket is closing
    }
  }

  public subscribeEvents(listener: ChatEventListener): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  public subscribeConnectionState(
    listener: ConnectionStateListener,
  ): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  public subscribeReconnectSync(listener: ReconnectSyncListener): () => void {
    this.syncListeners.add(listener);
    return () => {
      this.syncListeners.delete(listener);
    };
  }

  private ensureAppStateListener(): void {
    if (this.appStateSubscription) return;

    this.lastAppState = AppState.currentState;
    this.appStateSubscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        const wasBackground = this.lastAppState === 'background';
        this.lastAppState = nextState;

        if (
          wasBackground &&
          nextState === 'active' &&
          this.shouldStayConnected
        ) {
          // Reconcile with the database when returning from background
          this.notifySyncListeners();

          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.reconnectAttempts = 0;
            void this.openSocket();
          } else {
            // Verify socket liveness after OS wake
            this.sendPingWithTimeout();
          }
        }
      },
    );
  }

  private async openSocket(): Promise<void> {
    if (!this.shouldStayConnected || !this.activeUserId) return;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    let token = await getAccessToken();
    if (!token) {
      this.setState('disconnected');
      return;
    }

    if (isJwtExpiredOrNearExpiry(token)) {
      try {
        await apiFetch('/user/me');
        token = await getAccessToken();
      } catch {
        // Proceed with existing token or let close handler retry
      }
      if (!token) {
        this.setState('disconnected');
        return;
      }
    }

    this.setState(this.hadConnectedOnce ? 'reconnecting' : 'connecting');

    const wsUrl = `${resolveWsBaseUrl()}/chat/ws?token=${encodeURIComponent(token)}`;

    let socket: WebSocket;
    let opened = false;
    try {
      socket = new WebSocket(wsUrl);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws = socket;

    socket.onopen = () => {
      if (this.ws !== socket) return;
      opened = true;
      const isReconnect = this.hadConnectedOnce;
      this.hadConnectedOnce = true;
      this.reconnectAttempts = 0;
      this.setState('connected');
      this.startHeartbeat();

      // If we reconnected after a drop, reconcile missed messages from DB
      if (isReconnect) {
        this.notifySyncListeners();
      }
    };

    socket.onmessage = (event) => {
      if (this.ws !== socket) return;
      this.clearPongTimeout();

      const rawData = event.data;
      if (typeof rawData !== 'string') return;

      if (rawData === 'pong') {
        return;
      }

      try {
        const parsed = JSON.parse(rawData) as Record<string, unknown>;
        this.handleIncomingPayload(parsed);
      } catch {
        // Ignore malformed non-JSON frames
      }
    };

    socket.onerror = () => {
      // `onclose` will fire immediately after `onerror` and handle backoff
    };

    socket.onclose = (event) => {
      if (this.ws !== socket) return;
      this.ws = null;
      this.clearTimers();

      if (!this.shouldStayConnected) {
        this.setState('idle');
        return;
      }

      // Code 4001 or an immediate handshake rejection (!opened && 1006) indicates
      // the JWT access token may have expired.
      if (event.code === 4001 || (!opened && event.code === 1006)) {
        void this.refreshTokenAndReconnect();
        return;
      }

      this.scheduleReconnect();
    };
  }

  private handleIncomingPayload(parsed: Record<string, unknown>): void {
    const eventType = parsed.type;

    if (
      eventType === 'new_message' &&
      parsed.message &&
      typeof parsed.message === 'object'
    ) {
      const normalized = normalizeChatMessage(
        parsed.message as unknown as Parameters<typeof normalizeChatMessage>[0],
      );
      const wsEvent: ChatWsEvent = {
        type: 'new_message',
        message: normalized,
      };
      this.emitEvent(wsEvent);
      return;
    }

    if (eventType === 'messages_read' && typeof parsed.room_id === 'string') {
      const wsEvent: ChatWsEvent = {
        type: 'messages_read',
        room_id: parsed.room_id,
        job_id: typeof parsed.job_id === 'string' ? parsed.job_id : undefined,
        reader_id:
          typeof parsed.reader_id === 'string' ? parsed.reader_id : undefined,
      };
      this.emitEvent(wsEvent);
      return;
    }

    if (
      eventType === 'typing' &&
      typeof parsed.job_id === 'string' &&
      typeof parsed.user_id === 'string'
    ) {
      const wsEvent: ChatWsEvent = {
        type: 'typing',
        room_id:
          typeof parsed.room_id === 'string' ? parsed.room_id : undefined,
        job_id: parsed.job_id,
        user_id: parsed.user_id,
        user_name:
          typeof parsed.user_name === 'string' ? parsed.user_name : null,
        is_typing: Boolean(parsed.is_typing),
      };
      this.emitEvent(wsEvent);
    }
  }

  private emitEvent(wsEvent: ChatWsEvent): void {
    this.eventListeners.forEach((listener) => {
      try {
        listener(wsEvent);
      } catch {
        // Ignore subscriber errors
      }
    });
  }

  private async refreshTokenAndReconnect(): Promise<void> {
    if (this.isRefreshingToken || !this.shouldStayConnected) return;
    this.isRefreshingToken = true;
    try {
      // Trigger `apiFetch`'s built-in 401 -> /auth/refresh pipeline
      await apiFetch('/user/me');
    } catch {
      // If session is irrecoverably expired, apiClient's sessionExpiredHandler will clean up
    } finally {
      this.isRefreshingToken = false;
    }

    if (this.shouldStayConnected) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldStayConnected || this.reconnectTimer) return;

    this.setState(this.hadConnectedOnce ? 'reconnecting' : 'disconnected');

    const expDelay = Math.min(
      BASE_RECONNECT_MS * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_MS,
    );
    const jitter = Math.floor(Math.random() * 750);
    const delay = expDelay + jitter;
    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.openSocket();
    }, delay);
  }

  private startHeartbeat(): void {
    this.clearTimers();
    this.pingInterval = setInterval(() => {
      this.sendPingWithTimeout();
    }, PING_INTERVAL_MS);
  }

  private sendPingWithTimeout(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.sendRaw('ping');
    this.clearPongTimeout();

    this.pongTimeout = setTimeout(() => {
      // Socket did not respond to ping within timeout — recycle connection
      if (this.ws) {
        try {
          this.ws.close(4000, 'Heartbeat timeout');
        } catch {
          // Ignore
        }
      }
    }, PONG_TIMEOUT_MS);
  }

  private sendRaw(data: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(data);
    } catch {
      // Ignore send errors on closing socket
    }
  }

  private clearPongTimeout(): void {
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    this.clearPongTimeout();
  }
}

export const chatSocketManager = new ChatSocketManager();
