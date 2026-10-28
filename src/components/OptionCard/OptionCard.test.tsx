import { expect, it, vi } from 'vitest';
import OptionCard from './index';

it('键盘选择卡片且禁用时不触发选择', () => {
  const onClick = vi.fn();
  const active = OptionCard({ title: '职业', selected: true, onClick });
  const keyDown = active.props.onKeyDown;
  const event = (key: string) => ({ key, preventDefault: vi.fn() });

  const enter = event('Enter');
  keyDown(enter);
  expect(enter.preventDefault).toHaveBeenCalledOnce();
  const space = event(' ');
  keyDown(space);
  expect(space.preventDefault).toHaveBeenCalledOnce();
  keyDown(event('ArrowDown'));
  expect(onClick).toHaveBeenCalledTimes(2);
  expect(active.props['aria-pressed']).toBe(true);

  const disabled = OptionCard({ title: '职业', disabled: true, onClick });
  disabled.props.onKeyDown(event('Enter'));
  expect(onClick).toHaveBeenCalledTimes(2);
  expect(disabled.props.tabIndex).toBe(-1);
  expect(disabled.props['aria-disabled']).toBe(true);
});
