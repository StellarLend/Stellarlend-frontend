import { NotificationType } from '@/lib/notifications/types';

const MAX_TITLE_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_USER_ID_LENGTH = 256;
const VALID_NOTIFICATION_TYPES: NotificationType[] = ['info', 'success', 'warning', 'error'];
const NOTIFICATION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateNotificationId(id: unknown): ValidationResult {
  if (typeof id !== 'string') {
    return { valid: false, error: 'Notification ID must be a string' };
  }
  if (id.trim().length === 0) {
    return { valid: false, error: 'Notification ID cannot be empty' };
  }
  if (id.length > 128) {
    return { valid: false, error: 'Notification ID exceeds maximum length' };
  }
  if (!NOTIFICATION_ID_PATTERN.test(id)) {
    return { valid: false, error: 'Notification ID contains invalid characters' };
  }
  return { valid: true };
}

export function validateUserId(userId: unknown): ValidationResult {
  if (typeof userId !== 'string') {
    return { valid: false, error: 'User ID must be a string' };
  }
  if (userId.trim().length === 0) {
    return { valid: false, error: 'User ID cannot be empty' };
  }
  if (userId.length > MAX_USER_ID_LENGTH) {
    return { valid: false, error: 'User ID exceeds maximum length' };
  }
  return { valid: true };
}

export function validateNotificationType(type: unknown): ValidationResult {
  if (typeof type !== 'string') {
    return { valid: false, error: 'Notification type must be a string' };
  }
  if (!VALID_NOTIFICATION_TYPES.includes(type as NotificationType)) {
    return { valid: false, error: `Invalid notification type: ${type}` };
  }
  return { valid: true };
}

export function validateNotificationContent(title: unknown, message: unknown): ValidationResult {
  if (typeof title !== 'string') {
    return { valid: false, error: 'Title must be a string' };
  }
  if (title.trim().length === 0) {
    return { valid: false, error: 'Title cannot be empty' };
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return { valid: false, error: 'Title exceeds maximum length' };
  }

  if (typeof message !== 'string') {
    return { valid: false, error: 'Message must be a string' };
  }
  if (message.trim().length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: 'Message exceeds maximum length' };
  }

  return { valid: true };
}

export interface NotificationPayload {
  userId: unknown;
  title: unknown;
  message: unknown;
  type: unknown;
  id?: unknown;
}

export function validateNotificationPayload(payload: NotificationPayload): ValidationResult {
  const userIdResult = validateUserId(payload.userId);
  if (!userIdResult.valid) {
    return userIdResult;
  }

  const contentResult = validateNotificationContent(payload.title, payload.message);
  if (!contentResult.valid) {
    return contentResult;
  }

  const typeResult = validateNotificationType(payload.type);
  if (!typeResult.valid) {
    return typeResult;
  }

  if (payload.id !== undefined) {
    const idResult = validateNotificationId(payload.id);
    if (!idResult.valid) {
      return idResult;
    }
  }

  return { valid: true };
}

export function sanitizeNotificationId(id: string): string {
  return id.trim();
}

export function sanitizeUserId(userId: string): string {
  return userId.trim();
}
