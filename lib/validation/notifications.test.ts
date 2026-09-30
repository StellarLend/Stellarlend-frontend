import { describe, it, expect } from 'vitest';
import {
  validateNotificationId,
  validateUserId,
  validateNotificationType,
  validateNotificationContent,
  validateNotificationPayload,
  sanitizeNotificationId,
  sanitizeUserId,
} from '@/lib/validation/notifications';

describe('lib/validation/notifications', () => {
  describe('validateNotificationId', () => {
    it('accepts valid alphanumeric IDs', () => {
      expect(validateNotificationId('notif-123')).toEqual({ valid: true });
      expect(validateNotificationId('abc_456')).toEqual({ valid: true });
      expect(validateNotificationId('simple')).toEqual({ valid: true });
    });

    it('rejects empty IDs', () => {
      expect(validateNotificationId('')).toEqual({
        valid: false,
        error: 'Notification ID cannot be empty',
      });
    });

    it('rejects non-string IDs', () => {
      expect(validateNotificationId(123)).toEqual({
        valid: false,
        error: 'Notification ID must be a string',
      });
      expect(validateNotificationId(null)).toEqual({
        valid: false,
        error: 'Notification ID must be a string',
      });
      expect(validateNotificationId(undefined)).toEqual({
        valid: false,
        error: 'Notification ID must be a string',
      });
    });

    it('rejects IDs exceeding maximum length', () => {
      const longId = 'a'.repeat(129);
      expect(validateNotificationId(longId)).toEqual({
        valid: false,
        error: 'Notification ID exceeds maximum length',
      });
    });

    it('rejects IDs with invalid characters (path traversal attempt)', () => {
      expect(validateNotificationId('../../etc/passwd')).toEqual({
        valid: false,
        error: 'Notification ID contains invalid characters',
      });
    });

    it('rejects IDs with SQL injection patterns', () => {
      expect(validateNotificationId("'; DROP TABLE notifications;--")).toEqual({
        valid: false,
        error: 'Notification ID contains invalid characters',
      });
    });

    it('rejects IDs with special characters', () => {
      expect(validateNotificationId('notif<script>alert(1)</script>')).toEqual({
        valid: false,
        error: 'Notification ID contains invalid characters',
      });
    });
  });

  describe('validateUserId', () => {
    it('accepts valid user IDs', () => {
      expect(validateUserId('user-123')).toEqual({ valid: true });
      expect(validateUserId('wallet-GABC...')).toEqual({ valid: true });
    });

    it('rejects empty user IDs', () => {
      expect(validateUserId('')).toEqual({
        valid: false,
        error: 'User ID cannot be empty',
      });
    });

    it('rejects non-string user IDs', () => {
      expect(validateUserId(123)).toEqual({
        valid: false,
        error: 'User ID must be a string',
      });
    });

    it('rejects user IDs exceeding maximum length', () => {
      const longId = 'a'.repeat(257);
      expect(validateUserId(longId)).toEqual({
        valid: false,
        error: 'User ID exceeds maximum length',
      });
    });
  });

  describe('validateNotificationType', () => {
    it('accepts valid notification types', () => {
      expect(validateNotificationType('info')).toEqual({ valid: true });
      expect(validateNotificationType('success')).toEqual({ valid: true });
      expect(validateNotificationType('warning')).toEqual({ valid: true });
      expect(validateNotificationType('error')).toEqual({ valid: true });
    });

    it('rejects invalid notification types', () => {
      expect(validateNotificationType('invalid')).toEqual({
        valid: false,
        error: 'Invalid notification type: invalid',
      });
    });

    it('rejects non-string types', () => {
      expect(validateNotificationType(123)).toEqual({
        valid: false,
        error: 'Notification type must be a string',
      });
    });
  });

  describe('validateNotificationContent', () => {
    it('accepts valid title and message', () => {
      expect(validateNotificationContent('Valid Title', 'Valid message')).toEqual({ valid: true });
    });

    it('rejects empty title', () => {
      expect(validateNotificationContent('', 'message')).toEqual({
        valid: false,
        error: 'Title cannot be empty',
      });
    });

    it('rejects title exceeding maximum length', () => {
      const longTitle = 'a'.repeat(201);
      expect(validateNotificationContent(longTitle, 'message')).toEqual({
        valid: false,
        error: 'Title exceeds maximum length',
      });
    });

    it('rejects empty message', () => {
      expect(validateNotificationContent('title', '')).toEqual({
        valid: false,
        error: 'Message cannot be empty',
      });
    });

    it('rejects message exceeding maximum length', () => {
      const longMessage = 'a'.repeat(2001);
      expect(validateNotificationContent('title', longMessage)).toEqual({
        valid: false,
        error: 'Message exceeds maximum length',
      });
    });

    it('rejects non-string title', () => {
      expect(validateNotificationContent(123 as any, 'message')).toEqual({
        valid: false,
        error: 'Title must be a string',
      });
    });

    it('rejects non-string message', () => {
      expect(validateNotificationContent('title', 123 as any)).toEqual({
        valid: false,
        error: 'Message must be a string',
      });
    });
  });

  describe('validateNotificationPayload', () => {
    it('accepts valid payload', () => {
      const result = validateNotificationPayload({
        userId: 'user-123',
        title: 'Test',
        message: 'Test message',
        type: 'info',
        id: 'notif-1',
      });
      expect(result).toEqual({ valid: true });
    });

    it('rejects payload with missing userId', () => {
      const result = validateNotificationPayload({
        userId: '',
        title: 'Test',
        message: 'Test message',
        type: 'info',
      });
      expect(result.valid).toBe(false);
    });

    it('rejects payload with invalid type', () => {
      const result = validateNotificationPayload({
        userId: 'user-123',
        title: 'Test',
        message: 'Test message',
        type: 'invalid',
      });
      expect(result.valid).toBe(false);
    });

    it('rejects payload with invalid ID', () => {
      const result = validateNotificationPayload({
        userId: 'user-123',
        title: 'Test',
        message: 'Test message',
        type: 'info',
        id: '../../etc/passwd',
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('sanitizeNotificationId', () => {
    it('trims whitespace from notification ID', () => {
      expect(sanitizeNotificationId('  notif-123  ')).toBe('notif-123');
    });
  });

  describe('sanitizeUserId', () => {
    it('trims whitespace from user ID', () => {
      expect(sanitizeUserId('  user-123  ')).toBe('user-123');
    });
  });
});
