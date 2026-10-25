import {
  commandPayloadSchemas,
  decodeCommandResult,
  type CommandPayloads,
  type CommandResults,
} from './workspace-commands';
import {
  isWorkspaceSnapshot,
  WorkspaceError,
  type WorkspaceOperation,
  type WorkspaceSnapshot,
} from './workspace';
import {
  fetchWorkspaceJson,
  WORKSPACE_REQUEST_TIMEOUT_MS,
  type WorkspaceTransport,
} from './workspace-http';

export type WorkspaceSessionState =
  | { status: 'loading'; snapshot: null; problem: null; busy: false }
  | { status: 'ready'; snapshot: WorkspaceSnapshot; problem: null; busy: boolean }
  | { status: 'error'; snapshot: null; problem: WorkspaceError; busy: false };
export type WorkspaceNotice = (message: string, tone: 'success' | 'error' | 'info') => void;
interface SessionOptions {
  configured: boolean;
  organizationId?: string;
  notify: WorkspaceNotice;
  clearNotices?: () => void;
  transport?: WorkspaceTransport;
}
const INITIAL_STATE: WorkspaceSessionState = {
  status: 'loading',
  snapshot: null,
  problem: null,
  busy: false,
};
const ACCESS_ERRORS = new Set([
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NO_MEMBERSHIP',
  'EMAIL_VERIFICATION_REQUIRED',
]);

/** Owns the lifetime of one mounted workspace. Auth cookies stay with Supabase/Next;
 * a snapshot is accepted only from the authenticated workspace endpoint. */
export class WorkspaceSession {
  private state: WorkspaceSessionState = INITIAL_STATE;
  private listeners = new Set<() => void>();
  private active = false;
  private epoch = 0;
  private readSerial = 0;
  private readController?: AbortController;
  private writeController?: AbortController;
  private identity?: string;
  private organizationId?: string;
  private keys = new Map<string, string>();
  private authChangeUntil = 0;
  private transport: WorkspaceTransport;

  constructor(private options: SessionOptions) {
    this.transport = options.transport ?? fetchWorkspaceJson;
  }
  getSnapshot = (): WorkspaceSessionState => this.state;
  getGeneration = (): number => this.epoch;
  getServerSnapshot = (): WorkspaceSessionState => INITIAL_STATE;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(state: WorkspaceSessionState) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  private cancelRead() {
    ++this.readSerial;
    this.readController?.abort();
    this.readController = undefined;
  }
  private invalidateRequests() {
    ++this.epoch;
    this.cancelRead();
    this.writeController?.abort();
    this.writeController = undefined;
  }
  private isCurrent(epoch: number) {
    return this.active && epoch === this.epoch;
  }
  start = () => {
    if (this.active) return;
    this.active = true;
    void this.refresh();
  };
  stop = () => {
    this.active = false;
    this.invalidateRequests();
    this.keys.clear();
    this.identity = undefined;
    this.organizationId = undefined;
    this.authChangeUntil = 0;
    this.state = INITIAL_STATE;
  };
  private invalidate(problem = new WorkspaceError('UNAUTHENTICATED', 401)) {
    this.invalidateRequests();
    this.keys.clear();
    this.identity = undefined;
    this.organizationId = undefined;
    this.options.clearNotices?.();
    this.publish({ status: 'error', snapshot: null, problem, busy: false });
  }
  beginAuthChange = () => {
    if (!this.active) return;
    // Hide the old account immediately, including requests already in flight.
    // A bounded pause allows focus/poll recovery if the sending tab closes.
    this.authChangeUntil = Date.now() + WORKSPACE_REQUEST_TIMEOUT_MS;
    this.invalidate();
  };
  endAuthChange = () => {
    if (!this.active) return;
    this.authChangeUntil = 0;
    this.invalidate();
    void this.refresh();
  };
  refresh = async (): Promise<boolean> => {
    if (!this.active || this.state.busy || Date.now() < this.authChangeUntil) return false;
    return this.load();
  };
  private async load(): Promise<boolean> {
    this.cancelRead();
    const serial = this.readSerial;
    const epoch = this.epoch;
    const controller = new AbortController();
    this.readController = controller;
    if (!this.state.snapshot) this.publish(INITIAL_STATE);
    try {
      if (!this.options.configured) throw new WorkspaceError('CONFIGURATION_REQUIRED', 503);
      const org = this.organizationId ?? this.options.organizationId;
      const data = await this.transport(
        `/api/workspace${org ? `?organizationId=${encodeURIComponent(org)}` : ''}`,
        { signal: controller.signal },
      );
      if (!this.isCurrent(epoch) || serial !== this.readSerial) return false;
      if (data && typeof data === 'object' && !('access' in data))
        throw new WorkspaceError('SCHEMA_NOT_READY', 503);
      if (!isWorkspaceSnapshot(data)) throw new WorkspaceError('INVALID_RESPONSE', 502);
      const identity = JSON.stringify([data.state.currentUserId, data.organization.id]);
      const identityChanged = Boolean(this.identity && this.identity !== identity);
      if (identityChanged) {
        ++this.epoch;
        this.writeController?.abort();
        this.writeController = undefined;
        this.keys.clear();
        this.options.clearNotices?.();
      }
      this.identity = identity;
      this.organizationId = data.organization.id;
      this.publish({
        status: 'ready',
        snapshot: data,
        problem: null,
        busy: identityChanged ? false : this.state.busy,
      });
      return true;
    } catch (error) {
      if (!this.isCurrent(epoch) || serial !== this.readSerial) return false;
      const problem =
        error instanceof WorkspaceError ? error : new WorkspaceError('CONNECTION_FAILED', 503);
      if (ACCESS_ERRORS.has(problem.code)) this.invalidate(problem);
      else this.publish({ status: 'error', snapshot: null, problem, busy: false });
      return false;
    } finally {
      if (this.readController === controller) this.readController = undefined;
    }
  }
  command = async <K extends WorkspaceOperation>(
    operation: K,
    payload: CommandPayloads[NoInfer<K>],
    success: string,
  ): Promise<CommandResults[K] | null> => {
    const active = this.state.snapshot;
    if (!this.active || !active || this.state.busy || Date.now() < this.authChangeUntil)
      return null;
    this.cancelRead();
    const epoch = this.epoch;
    const controller = new AbortController();
    this.writeController = controller;
    this.publish({ status: 'ready', snapshot: active, problem: null, busy: true });
    const fingerprint = JSON.stringify([
      active.state.currentUserId,
      active.organization.id,
      operation,
      payload,
    ]);
    const key = this.keys.get(fingerprint) ?? crypto.randomUUID();
    this.keys.set(fingerprint, key);
    try {
      const checked = commandPayloadSchemas[operation].safeParse(payload);
      if (!checked.success) throw new WorkspaceError('VALIDATION_FAILED', 400);
      const data = await this.transport('/api/workspace', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: active.organization.id,
          operation,
          payload: checked.data,
          idempotencyKey: key,
        }),
      });
      if (!this.isCurrent(epoch)) return null;
      const result = decodeCommandResult(operation, data);
      if (!result) throw new WorkspaceError('INVALID_RESPONSE', 502);
      this.keys.delete(fingerprint);
      const reloaded = await this.load();
      if (!this.isCurrent(epoch)) return null;
      this.options.notify(
        reloaded ? success : 'บันทึกแล้ว แต่ยังโหลดข้อมูลล่าสุดไม่ได้ กรุณาลองโหลดอีกครั้ง',
        reloaded ? 'success' : 'info',
      );
      return result;
    } catch (error) {
      if (!this.isCurrent(epoch)) return null;
      const failure =
        error instanceof WorkspaceError ? error : new WorkspaceError('CONNECTION_FAILED', 503);
      if (ACCESS_ERRORS.has(failure.code)) this.invalidate(failure);
      else if (failure.code === 'STALE_VERSION') {
        await this.load();
        if (!this.isCurrent(epoch)) return null;
      }
      this.options.notify(failure.message, 'error');
      return null;
    } finally {
      if (this.writeController === controller) this.writeController = undefined;
      if (this.isCurrent(epoch) && this.state.status === 'ready')
        this.publish({ ...this.state, busy: false });
    }
  };
}
