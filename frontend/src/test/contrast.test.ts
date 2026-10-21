import { describe, expect, it } from 'vitest';
import css from '../styles/tokens.css?raw';

// Check actual tokens, not a second palette that could drift from the UI.
function color(name: string) {
  const value = css.match(
    new RegExp('--color-' + name + ':\\s*(#[0-9a-f]{6})'),
  )?.[1];
  if (!value) throw new Error('Missing color token: ' + name);
  return value;
}
function luminance(hex: string) {
  const channels = (hex.replace('#', '').match(/../g) ?? [])
    .map((c) => parseInt(c, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return (
    (channels[0] ?? 0) * 0.2126 +
    (channels[1] ?? 0) * 0.7152 +
    (channels[2] ?? 0) * 0.0722
  );
}
function ratio(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
describe('non-text and text token contrast', () => {
  it('keeps control boundaries above 3:1 on white and light fields', () => {
    expect(
      ratio(color('control-border'), color('surface')),
    ).toBeGreaterThanOrEqual(3);
    expect(ratio(color('control-border'), '#f8fafc')).toBeGreaterThanOrEqual(3);
  });
  it('keeps light and dark focus indicators above 3:1', () => {
    expect(ratio(color('action'), color('surface'))).toBeGreaterThanOrEqual(3);
    expect(ratio('#ffffff', color('brand'))).toBeGreaterThanOrEqual(3);
  });
  it.each(['brand', 'action', 'success', 'warning', 'danger', 'muted'])(
    'keeps solid %s badge/button text above 4.5:1',
    (name) => {
      expect(ratio(color(name), '#ffffff')).toBeGreaterThanOrEqual(4.5);
    },
  );
});
