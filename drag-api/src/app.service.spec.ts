import { AppService } from './app.service';

describe('AppService', () => {
  it('should return OK', () => {
    const service = new AppService();
    expect(service.getHealth()).toBe('OK');
  });
});
