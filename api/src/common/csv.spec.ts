import { csvField, toCsv } from './csv';

describe('csv export safety', () => {
  it.each(['=SUM(A1)', '+1+1', '-2+3', '@cmd', '\tTAB'])(
    'neutralises formula starter %j',
    (v) => {
      expect(csvField(v).startsWith("'") || csvField(v).startsWith('"\'')).toBe(
        true,
      );
    },
  );
  it('quotes commas, quotes and newlines', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('line1\nline2')).toBe('"line1\nline2"');
  });
  it('leaves normal text and numbers alone, and handles null', () => {
    expect(csvField('Bought stock')).toBe('Bought stock');
    expect(csvField('25000.00')).toBe('25000.00');
    expect(csvField(null)).toBe('');
  });
  it('builds rows with CRLF', () => {
    expect(toCsv(['A', 'B'], [['1', '=x']])).toBe("A,B\r\n1,'=x\r\n");
  });
});
