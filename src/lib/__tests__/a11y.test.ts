import { describe, it, expect, vi } from 'vitest';
import { clickableProps } from '../a11y';

describe('clickableProps', () => {
  it('returns role, tabIndex, onClick, onKeyDown, and a focus-visible className', () => {
    const handler = vi.fn();
    const props = clickableProps(handler);
    expect(props.role).toBe('button');
    expect(props.tabIndex).toBe(0);
    expect(props.onClick).toBe(handler);
    expect(typeof props.onKeyDown).toBe('function');
    expect(props.className).toContain('focus-visible:');
  });

  it('merges an extra className when provided', () => {
    const props = clickableProps(() => {}, 'rounded p-4');
    expect(props.className).toContain('rounded');
    expect(props.className).toContain('p-4');
    expect(props.className).toContain('focus-visible:');
  });

  it('keyboard handler activates on Enter and Space', () => {
    const handler = vi.fn();
    const props = clickableProps(handler);
    const preventDefault = vi.fn();
    props.onKeyDown({ key: 'Enter', preventDefault } as unknown as React.KeyboardEvent);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalled();
    handler.mockClear();
    props.onKeyDown({ key: ' ', preventDefault } as unknown as React.KeyboardEvent);
    expect(handler).toHaveBeenCalledTimes(1);
    handler.mockClear();
    props.onKeyDown({ key: 'a', preventDefault } as unknown as React.KeyboardEvent);
    expect(handler).not.toHaveBeenCalled();
  });
});
