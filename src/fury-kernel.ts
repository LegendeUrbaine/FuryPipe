import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, isAbsolute } from 'node:path';

export const FURY_KERNEL_CONVERSATION_FORMAT = 'furypipe-kernel-conversation/v1' as const;
export const FURY_KERNEL_MESSAGE_FORMAT = 'furypipe-kernel-message/v1' as const;
export const FURY_KERNEL_TURN_FORMAT = 'furypipe-kernel-turn/v1' as const;

export type FuryKernelMessageRole = 'user' | 'assistant';
export type FuryKernelTurnStatus = 'accepted' | 'completed' | 'cancelled' | 'failed';

export interface FuryKernelMessage {
  readonly format: typeof FURY_KERNEL_MESSAGE_FORMAT;
  readonly messageId: string;
  readonly role: FuryKernelMessageRole;
  readonly content: string;
  readonly createdAt: number;
}

export interface FuryKernelTurn {
  readonly format: typeof FURY_KERNEL_TURN_FORMAT;
  readonly turnId: string;
  readonly requestMessageId: string;
  readonly responseMessageId?: string;
  readonly failureCode?: string;
  readonly status: FuryKernelTurnStatus;
  readonly createdAt: number;
  readonly completedAt?: number;
  readonly executionAuthority: false;
}

export interface FuryKernelConversationSnapshot {
  readonly format: typeof FURY_KERNEL_CONVERSATION_FORMAT;
  readonly conversationId: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly messages: readonly FuryKernelMessage[];
  readonly turns: readonly FuryKernelTurn[];
  readonly activeTurnId?: string;
  readonly authority: 'conversation-state';
  readonly executionAuthority: false;
}

export interface FuryKernelAcceptedTurn {
  readonly format: typeof FURY_KERNEL_TURN_FORMAT;
  readonly conversationId: string;
  readonly turn: FuryKernelTurn;
  readonly status: 'accepted';
  readonly executionAuthority: false;
}

export interface FuryKernelCompletedTurn {
  readonly format: typeof FURY_KERNEL_TURN_FORMAT;
  readonly conversationId: string;
  readonly turn: FuryKernelTurn;
  readonly status: 'completed';
  readonly executionAuthority: false;
}

export interface FuryKernelCancelledTurn {
  readonly format: typeof FURY_KERNEL_TURN_FORMAT;
  readonly conversationId: string;
  readonly turn: FuryKernelTurn;
  readonly status: 'cancelled';
  readonly executionAuthority: false;
}

export interface FuryKernelFailedTurn {
  readonly format: typeof FURY_KERNEL_TURN_FORMAT;
  readonly conversationId: string;
  readonly turn: FuryKernelTurn;
  readonly status: 'failed';
  readonly executionAuthority: false;
}

export interface FuryKernelConversationOptions {
  readonly now?: () => number;
  readonly maxConversations?: number;
  readonly maxMessagesPerConversation?: number;
  readonly maxTurnsPerConversation?: number;
  readonly maxMessageBytes?: number;
  readonly maxConversationBytes?: number;
  readonly maxInFlightTurns?: number;
  /** Optional local durable snapshot. Credentials and execution permits are never stored. */
  readonly stateFile?: string;
}

export interface FuryKernelClosedConversation {
  readonly format: typeof FURY_KERNEL_CONVERSATION_FORMAT;
  readonly conversationId: string;
  readonly status: 'closed';
  readonly closedAt: number;
  readonly executionAuthority: false;
}

export interface FuryKernelSubmitMessageInput {
  readonly conversationId: string;
  readonly messageId: string;
  readonly content: string;
}

export interface FuryKernelCompleteTurnInput {
  readonly conversationId: string;
  readonly turnId: string;
  readonly messageId: string;
  readonly content: string;
}

export interface FuryKernelCancelTurnInput {
  readonly conversationId: string;
  readonly turnId: string;
}

export interface FuryKernelFailTurnInput {
  readonly conversationId: string;
  readonly turnId: string;
  readonly failureCode: string;
}

export interface FuryKernelConversationStore {
  openConversation(): FuryKernelConversationSnapshot;
  inspectConversation(conversationId: string): FuryKernelConversationSnapshot;
  closeConversation(conversationId: string): FuryKernelClosedConversation;
  submitUserMessage(input: FuryKernelSubmitMessageInput): FuryKernelAcceptedTurn;
  completeTurn(input: FuryKernelCompleteTurnInput): FuryKernelCompletedTurn;
  cancelTurn(input: FuryKernelCancelTurnInput): FuryKernelCancelledTurn;
  failTurn(input: FuryKernelFailTurnInput): FuryKernelFailedTurn;
  activeConversationCount(): number;
  inFlightTurnCount(): number;
}

export type FuryKernelConversationErrorCode =
  | 'invalid-config'
  | 'invalid-conversation'
  | 'invalid-message'
  | 'conversation-limit'
  | 'conversation-in-flight'
  | 'message-limit'
  | 'turn-limit'
  | 'byte-limit'
  | 'turn-in-flight'
  | 'in-flight-limit'
  | 'message-replay'
  | 'turn-not-found'
  | 'turn-terminal';

export class FuryKernelConversationError extends Error {
  readonly code: FuryKernelConversationErrorCode;

  constructor(code: FuryKernelConversationErrorCode, message: string) {
    super(message);
    this.name = 'FuryKernelConversationError';
    this.code = code;
  }
}

interface MutableTurn {
  readonly turnId: string;
  readonly requestMessageId: string;
  responseMessageId?: string;
  failureCode?: string;
  status: FuryKernelTurnStatus;
  readonly createdAt: number;
  completedAt?: number;
}

interface ConversationState {
  readonly conversationId: string;
  readonly createdAt: number;
  updatedAt: number;
  readonly messages: FuryKernelMessage[];
  readonly turns: MutableTurn[];
  readonly messageIds: Set<string>;
  bytes: number;
  activeTurnId?: string;
}

interface PersistedKernelState {
  readonly format: 'furypipe-kernel-persistence/v1';
  readonly conversations: readonly FuryKernelConversationSnapshot[];
}

const DEFAULT_MAX_CONVERSATIONS = 32;
const HARD_MAX_CONVERSATIONS = 4096;
const DEFAULT_MAX_MESSAGES = 256;
const HARD_MAX_MESSAGES = 8192;
const DEFAULT_MAX_TURNS = 128;
const HARD_MAX_TURNS = 4096;
const DEFAULT_MAX_MESSAGE_BYTES = 64 * 1024;
const HARD_MAX_MESSAGE_BYTES = 1024 * 1024;
const DEFAULT_MAX_CONVERSATION_BYTES = 1024 * 1024;
const HARD_MAX_CONVERSATION_BYTES = 64 * 1024 * 1024;
const DEFAULT_MAX_IN_FLIGHT_TURNS = 16;
const HARD_MAX_IN_FLIGHT_TURNS = 1024;
const MAX_PERSISTED_STATE_BYTES = 32 * 1024 * 1024;
const FURY_KERNEL_PERSISTENCE_FORMAT = 'furypipe-kernel-persistence/v1' as const;

const CONVERSATION_ID_RE = /^fkc_[A-Za-z0-9_-]{24}$/u;
const TURN_ID_RE = /^fkt_[A-Za-z0-9_-]{24}$/u;
const MESSAGE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;
const FAILURE_CODE_RE = /^[a-z][a-z0-9._:-]{0,95}$/u;

function finiteNow(now: () => number): number {
  const value = now();
  const normalized = Math.floor(value);
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(normalized)) {
    throw new FuryKernelConversationError(
      'invalid-config',
      'Fury Kernel conversation clock must return a safe non-negative timestamp',
    );
  }
  return normalized;
}

function boundedInteger(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
  label: string,
): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < min || resolved > max) {
    throw new FuryKernelConversationError(
      'invalid-config',
      `${label} must be an integer between ${min} and ${max}`,
    );
  }
  return resolved;
}

function assertExactKeys(
  value: unknown,
  allowedKeys: readonly string[],
  code: FuryKernelConversationErrorCode,
  label: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new FuryKernelConversationError(code, `${label} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new FuryKernelConversationError(code, `${label} must use a plain-object prototype`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new FuryKernelConversationError(code, `${label} must not contain symbol keys`);
  }
  const allowed = new Set(allowedKeys);
  for (const key of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor) || !allowed.has(key)) {
      throw new FuryKernelConversationError(code, `${label} contains unsupported fields`);
    }
  }
}

function canonicalId(
  value: unknown,
  pattern: RegExp,
  code: FuryKernelConversationErrorCode,
  label: string,
): string {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new FuryKernelConversationError(code, `${label} is invalid`);
  }
  return value;
}

function conversationId(value: unknown): string {
  return canonicalId(value, CONVERSATION_ID_RE, 'invalid-conversation', 'conversation ID');
}

function messageId(value: unknown): string {
  return canonicalId(value, MESSAGE_ID_RE, 'invalid-message', 'message ID');
}

function turnId(value: unknown): string {
  return canonicalId(value, TURN_ID_RE, 'turn-not-found', 'turn ID');
}

function messageContent(value: unknown, maxBytes: number): { readonly content: string; readonly bytes: number } {
  if (typeof value !== 'string' || value.length === 0 || !/\S/u.test(value) || value.includes('\0')) {
    throw new FuryKernelConversationError(
      'invalid-message',
      'conversation message must be non-empty text without NUL bytes',
    );
  }
  const bytes = Buffer.byteLength(value, 'utf8');
  if (bytes > maxBytes) {
    throw new FuryKernelConversationError(
      'byte-limit',
      'conversation message exceeds its UTF-8 byte limit',
    );
  }
  return Object.freeze({ content: value, bytes });
}

function nextOpaqueId(prefix: 'fkc_' | 'fkt_', exists: (id: string) => boolean): string {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const candidate = `${prefix}${randomBytes(18).toString('base64url')}`;
    if (!exists(candidate)) return candidate;
  }
  throw new FuryKernelConversationError('invalid-config', 'could not allocate a unique Fury Kernel identifier');
}

function cloneMessage(message: FuryKernelMessage): FuryKernelMessage {
  return Object.freeze({ ...message });
}

function cloneTurn(turn: MutableTurn): FuryKernelTurn {
  return Object.freeze({
    format: FURY_KERNEL_TURN_FORMAT,
    turnId: turn.turnId,
    requestMessageId: turn.requestMessageId,
    ...(turn.responseMessageId === undefined ? {} : { responseMessageId: turn.responseMessageId }),
    ...(turn.failureCode === undefined ? {} : { failureCode: turn.failureCode }),
    status: turn.status,
    createdAt: turn.createdAt,
    ...(turn.completedAt === undefined ? {} : { completedAt: turn.completedAt }),
    executionAuthority: false,
  });
}

function snapshot(state: ConversationState): FuryKernelConversationSnapshot {
  return Object.freeze({
    format: FURY_KERNEL_CONVERSATION_FORMAT,
    conversationId: state.conversationId,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    messages: Object.freeze(state.messages.map(cloneMessage)),
    turns: Object.freeze(state.turns.map(cloneTurn)),
    ...(state.activeTurnId === undefined ? {} : { activeTurnId: state.activeTurnId }),
    authority: 'conversation-state' as const,
    executionAuthority: false as const,
  });
}

function persistedTimestamp(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new FuryKernelConversationError('invalid-config', `${label} is invalid in persisted Kernel state`);
  }
  return value as number;
}

function persistedString(value: unknown, label: string, maximum = 256): string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > maximum
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new FuryKernelConversationError('invalid-config', `${label} is invalid in persisted Kernel state`);
  }
  return value;
}

function loadPersistedKernelState(
  stateFile: string,
  startupAt: number,
  limits: {
    readonly maxConversations: number;
    readonly maxMessages: number;
    readonly maxTurns: number;
    readonly maxMessageBytes: number;
    readonly maxConversationBytes: number;
  },
): { readonly states: readonly ConversationState[]; readonly repaired: boolean } {
  if (!existsSync(stateFile)) return Object.freeze({ states: Object.freeze([]), repaired: false });

  let encoded: string;
  try {
    encoded = readFileSync(stateFile, 'utf8');
  } catch {
    throw new FuryKernelConversationError('invalid-config', 'persisted Kernel state cannot be read');
  }
  if (Buffer.byteLength(encoded, 'utf8') > MAX_PERSISTED_STATE_BYTES) {
    throw new FuryKernelConversationError('invalid-config', 'persisted Kernel state exceeds its safety limit');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(encoded) as unknown;
  } catch {
    throw new FuryKernelConversationError('invalid-config', 'persisted Kernel state is not valid JSON');
  }
  assertExactKeys(
    raw,
    ['format', 'conversations'],
    'invalid-config',
    'persisted Kernel state',
  );
  if (raw.format !== FURY_KERNEL_PERSISTENCE_FORMAT || !Array.isArray(raw.conversations)) {
    throw new FuryKernelConversationError('invalid-config', 'persisted Kernel state format is unsupported');
  }
  if (raw.conversations.length > limits.maxConversations) {
    throw new FuryKernelConversationError('invalid-config', 'persisted Kernel state exceeds conversation capacity');
  }

  const states: ConversationState[] = [];
  const conversationIds = new Set<string>();
  let repaired = false;
  for (const rawConversation of raw.conversations) {
    assertExactKeys(
      rawConversation,
      ['format', 'conversationId', 'createdAt', 'updatedAt', 'messages', 'turns', 'activeTurnId', 'authority', 'executionAuthority'],
      'invalid-config',
      'persisted conversation',
    );
    if (
      rawConversation.format !== FURY_KERNEL_CONVERSATION_FORMAT
      || rawConversation.authority !== 'conversation-state'
      || rawConversation.executionAuthority !== false
      || !Array.isArray(rawConversation.messages)
      || !Array.isArray(rawConversation.turns)
    ) {
      throw new FuryKernelConversationError('invalid-config', 'persisted conversation metadata is invalid');
    }
    const id = canonicalId(
      rawConversation.conversationId,
      CONVERSATION_ID_RE,
      'invalid-config',
      'persisted conversation ID',
    );
    if (conversationIds.has(id)) {
      throw new FuryKernelConversationError('invalid-config', 'persisted conversation IDs are duplicated');
    }
    conversationIds.add(id);
    const createdAt = persistedTimestamp(rawConversation.createdAt, 'persisted conversation createdAt');
    let updatedAt = persistedTimestamp(rawConversation.updatedAt, 'persisted conversation updatedAt');
    if (updatedAt < createdAt) {
      throw new FuryKernelConversationError('invalid-config', 'persisted conversation timestamps are inconsistent');
    }
    if (rawConversation.messages.length > limits.maxMessages || rawConversation.turns.length > limits.maxTurns) {
      throw new FuryKernelConversationError('invalid-config', 'persisted conversation exceeds configured limits');
    }

    const messages: FuryKernelMessage[] = [];
    const messageIds = new Set<string>();
    let bytes = 0;
    for (const rawMessage of rawConversation.messages) {
      assertExactKeys(
        rawMessage,
        ['format', 'messageId', 'role', 'content', 'createdAt'],
        'invalid-config',
        'persisted message',
      );
      if (
        rawMessage.format !== FURY_KERNEL_MESSAGE_FORMAT
        || (rawMessage.role !== 'user' && rawMessage.role !== 'assistant')
      ) {
        throw new FuryKernelConversationError('invalid-config', 'persisted message metadata is invalid');
      }
      const message = persistedString(rawMessage.messageId, 'persisted message ID', 96);
      if (!MESSAGE_ID_RE.test(message) || messageIds.has(message)) {
        throw new FuryKernelConversationError('invalid-config', 'persisted message ID is invalid or duplicated');
      }
      const content = persistedString(rawMessage.content, 'persisted message content', limits.maxMessageBytes);
      const contentBytes = Buffer.byteLength(content, 'utf8');
      if (contentBytes > limits.maxMessageBytes || bytes + contentBytes > limits.maxConversationBytes) {
        throw new FuryKernelConversationError('invalid-config', 'persisted conversation exceeds byte limits');
      }
      const created = persistedTimestamp(rawMessage.createdAt, 'persisted message createdAt');
      if (created < createdAt || created > updatedAt) {
        throw new FuryKernelConversationError('invalid-config', 'persisted message timestamp is inconsistent');
      }
      messages.push(Object.freeze({
        format: FURY_KERNEL_MESSAGE_FORMAT,
        messageId: message,
        role: rawMessage.role,
        content,
        createdAt: created,
      }));
      messageIds.add(message);
      bytes += contentBytes;
    }

    const turns: MutableTurn[] = [];
    const turnIds = new Set<string>();
    const acceptedTurnIds = new Set<string>();
    for (const rawTurn of rawConversation.turns) {
      assertExactKeys(
        rawTurn,
        ['format', 'turnId', 'requestMessageId', 'responseMessageId', 'failureCode', 'status', 'createdAt', 'completedAt', 'executionAuthority'],
        'invalid-config',
        'persisted turn',
      );
      if (
        rawTurn.format !== FURY_KERNEL_TURN_FORMAT
        || rawTurn.executionAuthority !== false
        || !['accepted', 'completed', 'cancelled', 'failed'].includes(String(rawTurn.status))
      ) {
        throw new FuryKernelConversationError('invalid-config', 'persisted turn metadata is invalid');
      }
      const persistedTurnId = canonicalId(
        rawTurn.turnId,
        TURN_ID_RE,
        'invalid-config',
        'persisted turn ID',
      );
      if (turnIds.has(persistedTurnId)) {
        throw new FuryKernelConversationError('invalid-config', 'persisted turn IDs are duplicated');
      }
      turnIds.add(persistedTurnId);
      const requestMessageId = persistedString(rawTurn.requestMessageId, 'persisted request message ID', 96);
      const requestMessage = messages.find((message) => message.messageId === requestMessageId);
      if (!requestMessage || requestMessage.role !== 'user') {
        throw new FuryKernelConversationError('invalid-config', 'persisted turn request does not reference a user message');
      }
      const created = persistedTimestamp(rawTurn.createdAt, 'persisted turn createdAt');
      if (created < createdAt || created > updatedAt) {
        throw new FuryKernelConversationError('invalid-config', 'persisted turn timestamp is inconsistent');
      }
      const responseMessageId = rawTurn.responseMessageId === undefined
        ? undefined
        : persistedString(rawTurn.responseMessageId, 'persisted response message ID', 96);
      if (responseMessageId !== undefined) {
        const response = messages.find((message) => message.messageId === responseMessageId);
        if (!response || response.role !== 'assistant') {
          throw new FuryKernelConversationError('invalid-config', 'persisted turn response is invalid');
        }
      }
      const failureCode = rawTurn.failureCode === undefined
        ? undefined
        : persistedString(rawTurn.failureCode, 'persisted turn failure code', 96);
      if (failureCode !== undefined && !FAILURE_CODE_RE.test(failureCode)) {
        throw new FuryKernelConversationError('invalid-config', 'persisted turn failure code is invalid');
      }
      const completedAt = rawTurn.completedAt === undefined
        ? undefined
        : persistedTimestamp(rawTurn.completedAt, 'persisted turn completedAt');
      if (completedAt !== undefined && (completedAt < created || completedAt > Math.max(updatedAt, startupAt))) {
        throw new FuryKernelConversationError('invalid-config', 'persisted turn completion timestamp is inconsistent');
      }

      const turn: MutableTurn = {
        turnId: persistedTurnId,
        requestMessageId,
        ...(responseMessageId === undefined ? {} : { responseMessageId }),
        ...(failureCode === undefined ? {} : { failureCode }),
        status: rawTurn.status as FuryKernelTurnStatus,
        createdAt: created,
        ...(completedAt === undefined ? {} : { completedAt }),
      };
      if (turn.status === 'accepted') {
        acceptedTurnIds.add(persistedTurnId);
        if (responseMessageId !== undefined || failureCode !== undefined || completedAt !== undefined) {
          throw new FuryKernelConversationError('invalid-config', 'persisted accepted turn is already terminal');
        }
        turn.status = 'failed';
        turn.failureCode = 'recovered-process-restart';
        turn.completedAt = Math.max(startupAt, created);
        repaired = true;
        updatedAt = Math.max(updatedAt, turn.completedAt);
      } else if (turn.status === 'completed') {
        if (responseMessageId === undefined || completedAt === undefined || failureCode !== undefined) {
          throw new FuryKernelConversationError('invalid-config', 'persisted completed turn is incomplete');
        }
      } else if (turn.status === 'failed') {
        if (failureCode === undefined || completedAt === undefined || responseMessageId !== undefined) {
          throw new FuryKernelConversationError('invalid-config', 'persisted failed turn is incomplete');
        }
      } else if (responseMessageId !== undefined || completedAt === undefined || failureCode !== undefined) {
        throw new FuryKernelConversationError('invalid-config', 'persisted cancelled turn is incomplete');
      }
      turns.push(turn);
    }

    if (rawConversation.activeTurnId !== undefined) {
      const active = persistedString(rawConversation.activeTurnId, 'persisted active turn ID', 64);
      if (!acceptedTurnIds.has(active)) {
        throw new FuryKernelConversationError('invalid-config', 'persisted active turn is not accepted');
      }
      // Accepted turns are always terminalized during recovery above.
      repaired = true;
    } else if (acceptedTurnIds.size > 0) {
      throw new FuryKernelConversationError('invalid-config', 'persisted accepted turn has no active turn');
    }
    const state: ConversationState = {
      conversationId: id,
      createdAt,
      updatedAt,
      messages,
      turns,
      messageIds,
      bytes,
    };
    states.push(state);
  }
  return Object.freeze({ states: Object.freeze(states), repaired });
}

function persistKernelState(
  stateFile: string | undefined,
  conversations: ReadonlyMap<string, ConversationState>,
): void {
  if (stateFile === undefined) return;
  const payload: PersistedKernelState = {
    format: FURY_KERNEL_PERSISTENCE_FORMAT,
    conversations: Object.freeze([...conversations.values()].map(snapshot)),
  };
  const encoded = JSON.stringify(payload);
  if (Buffer.byteLength(encoded, 'utf8') > MAX_PERSISTED_STATE_BYTES) {
    throw new FuryKernelConversationError('invalid-config', 'persisted Kernel state exceeds its safety limit');
  }
  const temporary = `${stateFile}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    mkdirSync(dirname(stateFile), { recursive: true });
    writeFileSync(temporary, encoded, { encoding: 'utf8', flag: 'wx' });
    renameSync(temporary, stateFile);
  } catch {
    try {
      if (existsSync(temporary)) unlinkSync(temporary);
    } catch {
      // Preserve the original persistence failure.
    }
    throw new FuryKernelConversationError('invalid-config', 'persisted Kernel state cannot be written');
  }
}

function findTurn(state: ConversationState, id: string): MutableTurn {
  const found = state.turns.find((turn) => turn.turnId === id);
  if (!found) {
    throw new FuryKernelConversationError('turn-not-found', 'conversation turn was not found');
  }
  return found;
}

export function createFuryKernelConversationStore(
  options: FuryKernelConversationOptions = {},
): FuryKernelConversationStore {
  const now = options.now ?? Date.now;
  const maxConversations = boundedInteger(
    options.maxConversations,
    DEFAULT_MAX_CONVERSATIONS,
    1,
    HARD_MAX_CONVERSATIONS,
    'maxConversations',
  );
  const maxMessages = boundedInteger(
    options.maxMessagesPerConversation,
    DEFAULT_MAX_MESSAGES,
    2,
    HARD_MAX_MESSAGES,
    'maxMessagesPerConversation',
  );
  const maxTurns = boundedInteger(
    options.maxTurnsPerConversation,
    DEFAULT_MAX_TURNS,
    1,
    HARD_MAX_TURNS,
    'maxTurnsPerConversation',
  );
  const maxMessageBytes = boundedInteger(
    options.maxMessageBytes,
    DEFAULT_MAX_MESSAGE_BYTES,
    1,
    HARD_MAX_MESSAGE_BYTES,
    'maxMessageBytes',
  );
  const maxConversationBytes = boundedInteger(
    options.maxConversationBytes,
    DEFAULT_MAX_CONVERSATION_BYTES,
    maxMessageBytes,
    HARD_MAX_CONVERSATION_BYTES,
    'maxConversationBytes',
  );
  const maxInFlightTurns = boundedInteger(
    options.maxInFlightTurns,
    DEFAULT_MAX_IN_FLIGHT_TURNS,
    1,
    HARD_MAX_IN_FLIGHT_TURNS,
    'maxInFlightTurns',
  );

  const stateFile = options.stateFile;
  if (
    stateFile !== undefined
    && (
      typeof stateFile !== 'string'
      || stateFile.length === 0
      || stateFile !== stateFile.trim()
      || !isAbsolute(stateFile)
      || /[\u0000-\u001f\u007f]/u.test(stateFile)
    )
  ) {
    throw new FuryKernelConversationError(
      'invalid-config',
      'stateFile must be an absolute printable path',
    );
  }

  const conversations = new Map<string, ConversationState>();
  let inFlightTurns = 0;
  if (stateFile !== undefined) {
    const startupAt = finiteNow(now);
    const recovered = loadPersistedKernelState(stateFile, startupAt, {
      maxConversations,
      maxMessages,
      maxTurns,
      maxMessageBytes,
      maxConversationBytes,
    });
    for (const state of recovered.states) conversations.set(state.conversationId, state);
    if (recovered.repaired) persistKernelState(stateFile, conversations);
  }
  const persist = (): void => {
    persistKernelState(stateFile, conversations);
  };

  const requireConversation = (id: string): ConversationState => {
    const canonical = conversationId(id);
    const state = conversations.get(canonical);
    if (!state) {
      throw new FuryKernelConversationError(
        'invalid-conversation',
        'conversation does not exist in this Fury Kernel process',
      );
    }
    return state;
  };

  return Object.freeze({
    openConversation(...args: readonly unknown[]): FuryKernelConversationSnapshot {
      if (args.length !== 0) {
        throw new FuryKernelConversationError(
          'invalid-conversation',
          'conversation creation accepts no caller-supplied fields or identifiers',
        );
      }
      if (conversations.size >= maxConversations) {
        throw new FuryKernelConversationError('conversation-limit', 'active conversation limit reached');
      }
      const id = nextOpaqueId('fkc_', (candidate) => conversations.has(candidate));
      const at = finiteNow(now);
      const state: ConversationState = {
        conversationId: id,
        createdAt: at,
        updatedAt: at,
        messages: [],
        turns: [],
        messageIds: new Set<string>(),
        bytes: 0,
      };
      conversations.set(id, state);
      try {
        persist();
      } catch (error) {
        conversations.delete(id);
        throw error;
      }
      return snapshot(state);
    },

    inspectConversation(id: string): FuryKernelConversationSnapshot {
      return snapshot(requireConversation(id));
    },

    closeConversation(id: string): FuryKernelClosedConversation {
      const state = requireConversation(id);
      if (state.activeTurnId !== undefined) {
        throw new FuryKernelConversationError(
          'conversation-in-flight',
          'conversation cannot close while a turn is active',
        );
      }
      const closedAt = finiteNow(now);
      conversations.delete(state.conversationId);
      try {
        persist();
      } catch (error) {
        conversations.set(state.conversationId, state);
        throw error;
      }
      return Object.freeze({
        format: FURY_KERNEL_CONVERSATION_FORMAT,
        conversationId: state.conversationId,
        status: 'closed' as const,
        closedAt,
        executionAuthority: false as const,
      });
    },

    submitUserMessage(input: FuryKernelSubmitMessageInput): FuryKernelAcceptedTurn {
      assertExactKeys(
        input,
        ['conversationId', 'messageId', 'content'],
        'invalid-message',
        'message input',
      );
      const state = requireConversation(input.conversationId);
      const id = messageId(input.messageId);
      const body = messageContent(input.content, maxMessageBytes);

      if (state.activeTurnId !== undefined) {
        throw new FuryKernelConversationError(
          'turn-in-flight',
          'conversation already has an active turn',
        );
      }
      if (inFlightTurns >= maxInFlightTurns) {
        throw new FuryKernelConversationError('in-flight-limit', 'global in-flight turn limit reached');
      }
      if (state.messageIds.has(id)) {
        throw new FuryKernelConversationError('message-replay', 'message ID has already been used');
      }
      if (state.messages.length + 2 > maxMessages) {
        throw new FuryKernelConversationError(
          'message-limit',
          'conversation does not have capacity for a complete request/response turn',
        );
      }
      if (state.turns.length >= maxTurns) {
        throw new FuryKernelConversationError('turn-limit', 'conversation turn limit reached');
      }
      if (state.bytes + body.bytes > maxConversationBytes) {
        throw new FuryKernelConversationError('byte-limit', 'conversation byte limit reached');
      }

      const previousUpdatedAt = state.updatedAt;
      const at = finiteNow(now);
      const turn: MutableTurn = {
        turnId: nextOpaqueId(
          'fkt_',
          (candidate) => state.turns.some((existing) => existing.turnId === candidate),
        ),
        requestMessageId: id,
        status: 'accepted',
        createdAt: at,
      };
      const message: FuryKernelMessage = Object.freeze({
        format: FURY_KERNEL_MESSAGE_FORMAT,
        messageId: id,
        role: 'user',
        content: body.content,
        createdAt: at,
      });

      state.messages.push(message);
      state.messageIds.add(id);
      state.turns.push(turn);
      state.bytes += body.bytes;
      state.activeTurnId = turn.turnId;
      state.updatedAt = at;
      inFlightTurns += 1;
      try {
        persist();
      } catch (error) {
        state.messages.pop();
        state.messageIds.delete(id);
        state.turns.pop();
        state.bytes -= body.bytes;
        delete state.activeTurnId;
        state.updatedAt = previousUpdatedAt;
        inFlightTurns -= 1;
        throw error;
      }

      return Object.freeze({
        format: FURY_KERNEL_TURN_FORMAT,
        conversationId: state.conversationId,
        turn: cloneTurn(turn),
        status: 'accepted' as const,
        executionAuthority: false as const,
      });
    },

    completeTurn(input: FuryKernelCompleteTurnInput): FuryKernelCompletedTurn {
      assertExactKeys(
        input,
        ['conversationId', 'turnId', 'messageId', 'content'],
        'invalid-message',
        'turn completion input',
      );
      const state = requireConversation(input.conversationId);
      const requestedTurnId = turnId(input.turnId);
      const turn = findTurn(state, requestedTurnId);
      if (turn.status !== 'accepted' || state.activeTurnId !== turn.turnId) {
        throw new FuryKernelConversationError('turn-terminal', 'conversation turn is no longer active');
      }
      const responseId = messageId(input.messageId);
      if (state.messageIds.has(responseId)) {
        throw new FuryKernelConversationError('message-replay', 'message ID has already been used');
      }
      const body = messageContent(input.content, maxMessageBytes);
      if (state.messages.length + 1 > maxMessages) {
        throw new FuryKernelConversationError('message-limit', 'conversation message limit reached');
      }
      if (state.bytes + body.bytes > maxConversationBytes) {
        throw new FuryKernelConversationError('byte-limit', 'conversation byte limit reached');
      }

      const previousUpdatedAt = state.updatedAt;
      const previousBytes = state.bytes;
      const at = finiteNow(now);
      const response: FuryKernelMessage = Object.freeze({
        format: FURY_KERNEL_MESSAGE_FORMAT,
        messageId: responseId,
        role: 'assistant',
        content: body.content,
        createdAt: at,
      });
      state.messages.push(response);
      state.messageIds.add(responseId);
      state.bytes += body.bytes;
      state.updatedAt = at;
      delete state.activeTurnId;
      turn.status = 'completed';
      turn.responseMessageId = responseId;
      turn.completedAt = at;
      inFlightTurns -= 1;
      try {
        persist();
      } catch (error) {
        state.messages.pop();
        state.messageIds.delete(responseId);
        state.bytes = previousBytes;
        state.updatedAt = previousUpdatedAt;
        state.activeTurnId = turn.turnId;
        turn.status = 'accepted';
        delete turn.responseMessageId;
        delete turn.completedAt;
        inFlightTurns += 1;
        throw error;
      }

      return Object.freeze({
        format: FURY_KERNEL_TURN_FORMAT,
        conversationId: state.conversationId,
        turn: cloneTurn(turn),
        status: 'completed' as const,
        executionAuthority: false as const,
      });
    },

    cancelTurn(input: FuryKernelCancelTurnInput): FuryKernelCancelledTurn {
      assertExactKeys(
        input,
        ['conversationId', 'turnId'],
        'turn-not-found',
        'turn cancellation input',
      );
      const state = requireConversation(input.conversationId);
      const requestedTurnId = turnId(input.turnId);
      const turn = findTurn(state, requestedTurnId);
      if (turn.status !== 'accepted' || state.activeTurnId !== turn.turnId) {
        throw new FuryKernelConversationError('turn-terminal', 'conversation turn is no longer active');
      }
      const previousUpdatedAt = state.updatedAt;
      const at = finiteNow(now);
      turn.status = 'cancelled';
      turn.completedAt = at;
      state.updatedAt = at;
      delete state.activeTurnId;
      inFlightTurns -= 1;
      try {
        persist();
      } catch (error) {
        turn.status = 'accepted';
        delete turn.completedAt;
        state.updatedAt = previousUpdatedAt;
        state.activeTurnId = turn.turnId;
        inFlightTurns += 1;
        throw error;
      }

      return Object.freeze({
        format: FURY_KERNEL_TURN_FORMAT,
        conversationId: state.conversationId,
        turn: cloneTurn(turn),
        status: 'cancelled' as const,
        executionAuthority: false as const,
      });
    },

    failTurn(input: FuryKernelFailTurnInput): FuryKernelFailedTurn {
      assertExactKeys(
        input,
        ['conversationId', 'turnId', 'failureCode'],
        'invalid-message',
        'turn failure input',
      );
      const state = requireConversation(input.conversationId);
      const requestedTurnId = turnId(input.turnId);
      const turn = findTurn(state, requestedTurnId);
      if (turn.status !== 'accepted' || state.activeTurnId !== turn.turnId) {
        throw new FuryKernelConversationError('turn-terminal', 'conversation turn is no longer active');
      }
      if (
        typeof input.failureCode !== 'string'
        || !FAILURE_CODE_RE.test(input.failureCode)
      ) {
        throw new FuryKernelConversationError(
          'invalid-message',
          'turn failure code must be a bounded canonical identifier',
        );
      }
      const previousUpdatedAt = state.updatedAt;
      const at = finiteNow(now);
      turn.status = 'failed';
      turn.failureCode = input.failureCode;
      turn.completedAt = at;
      state.updatedAt = at;
      delete state.activeTurnId;
      inFlightTurns -= 1;
      try {
        persist();
      } catch (error) {
        turn.status = 'accepted';
        delete turn.failureCode;
        delete turn.completedAt;
        state.updatedAt = previousUpdatedAt;
        state.activeTurnId = turn.turnId;
        inFlightTurns += 1;
        throw error;
      }

      return Object.freeze({
        format: FURY_KERNEL_TURN_FORMAT,
        conversationId: state.conversationId,
        turn: cloneTurn(turn),
        status: 'failed' as const,
        executionAuthority: false as const,
      });
    },

    activeConversationCount(): number {
      return conversations.size;
    },

    inFlightTurnCount(): number {
      return inFlightTurns;
    },
  });
}
