import { ValidationError, AuthError, UpstreamError } from '../errors';

describe('API error classes', () => {
  describe('ValidationError', () => {
    it('is an instance of Error', () => {
      const e = new ValidationError('bad input');
      expect(e).toBeInstanceOf(Error);
      expect(e).toBeInstanceOf(ValidationError);
    });

    it('has statusCode 400', () => {
      expect(new ValidationError('x').statusCode).toBe(400);
    });

    it('preserves the message', () => {
      expect(new ValidationError('field is required').message).toBe('field is required');
    });

    it('sets the name to ValidationError', () => {
      expect(new ValidationError('x').name).toBe('ValidationError');
    });
  });

  describe('AuthError', () => {
    it('has statusCode 401', () => {
      expect(new AuthError('not logged in').statusCode).toBe(401);
    });

    it('preserves the message and name', () => {
      const e = new AuthError('token expired');
      expect(e.message).toBe('token expired');
      expect(e.name).toBe('AuthError');
      expect(e).toBeInstanceOf(Error);
    });
  });

  describe('UpstreamError', () => {
    it('has statusCode 502', () => {
      expect(new UpstreamError('soroban rpc unreachable').statusCode).toBe(502);
    });

    it('preserves the message and name', () => {
      const e = new UpstreamError('rpc timeout');
      expect(e.message).toBe('rpc timeout');
      expect(e.name).toBe('UpstreamError');
      expect(e).toBeInstanceOf(Error);
    });
  });

  it('statusCode is a real enumerable property so JSON serialisation picks it up', () => {
    const e = new ValidationError('bad');
    // statusCode and name are own enumerable properties (set in the class body).
    // message is inherited from Error and is not enumerable, so we only assert
    // on the two fields a custom toJSON would have to add explicitly.
    expect(Object.keys(e)).toEqual(expect.arrayContaining(['statusCode', 'name']));
  });
});
