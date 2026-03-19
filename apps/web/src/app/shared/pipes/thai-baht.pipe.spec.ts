import { ThaiBahtPipe } from './thai-baht.pipe';

describe('ThaiBahtPipe', () => {
  const pipe = new ThaiBahtPipe();

  it('formats integer prices', () => {
    const result = pipe.transform(59990);
    expect(result).toContain('59,990');
    expect(result).toContain('\u0E3F'); // ฿ symbol
  });

  it('formats decimal prices', () => {
    const result = pipe.transform(1299.5);
    expect(result).toContain('1,299.5');
  });

  it('formats zero', () => {
    const result = pipe.transform(0);
    expect(result).toContain('0.00');
  });
});
