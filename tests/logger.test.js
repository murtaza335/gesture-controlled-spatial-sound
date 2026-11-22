import { describe, it, expect } from 'vitest';
import { COLUMNS, csvEscape, createLogger, exportFilename } from '../src/study/logger.js';

describe('csvEscape', () => {
  it('leaves plain values alone', () => {
    expect(csvEscape('abc')).toBe('abc');
    expect(csvEscape(12.5)).toBe('12.5');
  });
  it('quotes commas, quotes and newlines', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('a\nb')).toBe('"a\nb"');
  });
  it('empties null/undefined and JSON-encodes objects', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
    expect(csvEscape({ a: 1, b: 2 })).toBe('"{""a"":1,""b"":2}"');
  });
});

describe('logger', () => {
  const make = () => {
    let t = 1000;
    const l = createLogger({ now: () => (t += 10) });
    l.setContext({ participant: 'P1', condition: 'slider', task_id: 'T1' });
    return l;
  };

  it('ignores events until started', () => {
    const l = make();
    l.log('grabStart');
    expect(l.count).toBe(0);
  });

  it('writes a header and one row per event', () => {
    const l = make();
    l.start();
    l.log('grabStart', { source_id: 0, az: 10 });
    l.log('param', { param: 'bass', value: 6, extra: { note: 'a,b' } });
    const lines = l.toCSV().trim().split('\n');
    expect(lines[0]).toBe(COLUMNS.join(','));
    expect(lines).toHaveLength(3);
    expect(lines[1].split(',')[1]).toBe('P1');
    expect(lines[2]).toContain('"{""note"":""a,b""}"');
  });

  it('timestamps are relative to start', () => {
    const l = make();
    l.start();
    l.log('x');
    expect(l.rows()[0].timestamp_ms).toBe(10);
  });
});

describe('exportFilename', () => {
  it('follows gsam_<participant>_<condition>_<yyyymmdd-hhmm>.csv', () => {
    expect(exportFilename('P 01', 'gesture', new Date(2026, 10, 22, 9, 5))).toBe('gsam_P_01_gesture_20261122-0905.csv');
  });
  it('falls back to anon', () => {
    expect(exportFilename('', 'slider', new Date(2026, 0, 2, 13, 45))).toBe('gsam_anon_slider_20260102-1345.csv');
  });
});
