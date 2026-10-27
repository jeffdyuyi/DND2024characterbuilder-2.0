import type { Metadata } from 'next';
import styles from './page.module.css';

const sourceUrl = 'https://github.com/tjliqy/5etools-cn/tree/cn2.0';
const upstreamLicenseUrl = 'https://github.com/tjliqy/5etools-cn/blob/cn2.0/LICENSE.md';
const ccLicenseUrl = 'https://creativecommons.org/licenses/by-nc-sa/4.0/';

export const metadata: Metadata = {
  title: '数据来源与许可 | D&D 2024 Character Builder',
};

export default function DataLicensePage() {
  return (
    <main className={styles.page}>
      <h1>数据来源与许可</h1>
      <p>
        本工具在线读取并在浏览器本地缓存、解析、筛选和展示{' '}
        <a href={sourceUrl} target="_blank" rel="noreferrer">
          5etools-cn（cn2.0）
        </a>{' '}
        的数据。项目由本站独立开发，不代表 5etools-cn、Kiwee 或其贡献者，也未获其背书。
      </p>

      <section>
        <h2>中文本地化内容</h2>
        <p>
          来源仓库 <code>data/</code> 中的中文本地化 JSON 由 Kiwee
          和贡献者署名；其译文来自民间汉化组及独立译者，并由「DND Common
          Library」整理排版。该部分依据{' '}
          <a href={ccLicenseUrl} target="_blank" rel="noreferrer">
            CC BY-NC-SA 4.0
          </a>{' '}
          许可使用。本站对数据进行缓存、结构化适配和页面呈现；不修改上游仓库的原始文件。本站基于这些中文内容形成的改编内容同样按
          CC BY-NC-SA 4.0
          提供。再利用须保留署名和协议链接、标明改动，并遵守非商业及相同方式共享条件。
        </p>
      </section>

      <section>
        <h2>源码与英文数据</h2>
        <p>
          上游仓库的源码和 <code>data-bak/</code> 英文数据适用 MIT
          许可，与中文本地化内容的许可范围不同。具体版权声明、许可文本及适用范围见{' '}
          <a href={upstreamLicenseUrl} target="_blank" rel="noreferrer">
            5etools-cn LICENSE.md
          </a>
          。
        </p>
      </section>

      <p className={styles.note}>
        本工具不是 Wizards of the Coast 的官方产品，也未获其批准或背书。5etools-cn
        的数据许可不自动授予其他原作或商标的使用权；第三方扩展内容各自遵循其来源的许可或使用条件。
      </p>
    </main>
  );
}
