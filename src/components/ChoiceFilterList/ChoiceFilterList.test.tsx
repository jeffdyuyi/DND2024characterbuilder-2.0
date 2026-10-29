import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import ChoiceFilterList, { filterChoiceOptions } from './index';

const options = ['common', 'elvish', 'deep-speech'];
const facets = [
  { sources: ['XPHB', 'PHB'], types: ['Standard'] },
  { sources: ['XPHB'], types: ['Standard'] },
  { sources: ['PHB'], types: ['Rare'] },
];

it('来源与类型交叉筛选只改变可见候选，不改原选项顺序和身份', () => {
  expect(filterChoiceOptions(options, facets, 'PHB', 'Standard')).toEqual(['common']);
  expect(filterChoiceOptions(options, facets, 'XPHB', 'Rare')).toEqual([]);
  expect(options).toEqual(['common', 'elvish', 'deep-speech']);
});

it('多来源多类型时显示两组筛选，单一维度不显示空筛选', () => {
  const render = (entries: string[]) => <div>{entries.join('、')}</div>;
  const html = renderToStaticMarkup(
    <ChoiceFilterList
      options={options}
      getFacets={(option) => facets[options.indexOf(option)]}
      render={render}
    />,
  );
  expect(html).toContain('aria-label="来源筛选"');
  expect(html).toContain('aria-label="类型筛选"');
  expect(html).toContain('common、elvish、deep-speech');

  const single = renderToStaticMarkup(
    <ChoiceFilterList
      options={['common']}
      getFacets={() => ({ sources: ['XPHB'], types: ['Standard'] })}
      render={render}
    />,
  );
  expect(single).not.toContain('筛选');
});
