'use client';

import React, { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCharacterStore } from '@/store/characterStore';
import { CharacterState } from '@/types/characterState';
import PillButton from '@/components/PillButton';
import styles from './page.module.css';

export default function DetailsPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const router = useRouter();
  const { characters, updateActiveCharacter, loadCharacter } = useCharacterStore();
  const character = (id ? characters[id] : null) as CharacterState | null;

  useEffect(() => {
    if (id) loadCharacter(id);
  }, [id, loadCharacter]);

  if (!character) return <div className="page-container">加载中...</div>;

  const handleChange = (field: string, value: string) => {
    updateActiveCharacter({ [field]: value });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>角色细节</h2>
          <p className={styles.subtitle}>
            补充角色基础信息、人物气质与背景故事，这些内容会直接进入角色卡 Biography 区域。
          </p>
        </div>
      </div>

      <div className={styles.scrollContent}>
        <div className={styles.innerContent}>
          {/* 角色头像与核心身份 */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>核心身份</div>
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              {/* 头像上传 */}
              <div className={styles.avatarSection}>
                <div
                  className={styles.avatarPreview}
                  onClick={() => document.getElementById('avatar-input')?.click()}
                  style={{
                    backgroundImage: character.avatarUrl ? `url(${character.avatarUrl})` : 'none',
                  }}
                >
                  {!character.avatarUrl && (
                    <span style={{ fontSize: 40, color: 'var(--color-text-tertiary)' }}>+</span>
                  )}
                  <div className={styles.avatarOverlay}>点击上传头像</div>
                </div>
                <input
                  id="avatar-input"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        handleChange('avatarUrl', reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </div>

              <div style={{ flex: 1 }}>
                <div className={`${styles.grid} ${styles.grid2}`}>
                  <label className={styles.label}>
                    <div className={styles.labelText}>角色姓名</div>
                    <input
                      className={styles.input}
                      value={character.name}
                      placeholder="例如：崔斯特·杜厄登"
                      onChange={(e) => handleChange('name', e.target.value)}
                    />
                  </label>
                  <label className={styles.label}>
                    <div className={styles.labelText}>代词</div>
                    <input
                      className={styles.input}
                      value={character.pronouns || ''}
                      placeholder="他 / 她 / 他们"
                      onChange={(e) => handleChange('pronouns', e.target.value)}
                    />
                  </label>
                </div>
                <div className={`${styles.grid} ${styles.grid2}`}>
                  <label className={styles.label}>
                    <div className={styles.labelText}>阵营</div>
                    <select
                      className={styles.input}
                      value={character.alignment || ''}
                      onChange={(e) => handleChange('alignment', e.target.value)}
                    >
                      <option value="">未选择</option>
                      <option value="Lawful Good">守序善良 (LG)</option>
                      <option value="Neutral Good">中立善良 (NG)</option>
                      <option value="Chaotic Good">混乱善良 (CG)</option>
                      <option value="Lawful Neutral">守序中立 (LN)</option>
                      <option value="Neutral">绝对中立 (N)</option>
                      <option value="Chaotic Neutral">混乱中立 (CN)</option>
                      <option value="Lawful Evil">守序邪恶 (LE)</option>
                      <option value="Neutral Evil">中立邪恶 (NE)</option>
                      <option value="Chaotic Evil">混乱邪恶 (CE)</option>
                    </select>
                  </label>
                  <label className={styles.label}>
                    <div className={styles.labelText}>玩家姓名</div>
                    <input
                      className={styles.input}
                      value={character.playerName || ''}
                      placeholder="您的姓名"
                      onChange={(e) => handleChange('playerName', e.target.value)}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className={`${styles.grid} ${styles.grid2}`}>
              <label className={styles.label}>
                <div className={styles.labelText}>信仰</div>
                <input
                  className={styles.input}
                  value={character.faith || ''}
                  placeholder="例如：塞伦涅"
                  onChange={(e) => handleChange('faith', e.target.value)}
                />
              </label>
              <label className={styles.label}>
                <div className={styles.labelText}>生活方式</div>
                <input
                  className={styles.input}
                  value={character.lifestyle || ''}
                  placeholder="舒适 (2gp/天)"
                  onChange={(e) => handleChange('lifestyle', e.target.value)}
                />
              </label>
            </div>
          </div>

          {/* 物理特征 */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>物理特征</div>
            <div className={`${styles.grid} ${styles.grid3}`}>
              <label className={styles.label}>
                <div className={styles.labelText}>性别</div>
                <input
                  className={styles.input}
                  value={character.gender || ''}
                  onChange={(e) => handleChange('gender', e.target.value)}
                />
              </label>
              <label className={styles.label}>
                <div className={styles.labelText}>年龄</div>
                <input
                  className={styles.input}
                  value={character.age || ''}
                  onChange={(e) => handleChange('age', e.target.value)}
                />
              </label>
              <label className={styles.label}>
                <div className={styles.labelText}>身高</div>
                <input
                  className={styles.input}
                  value={character.height || ''}
                  onChange={(e) => handleChange('height', e.target.value)}
                />
              </label>
            </div>
            <div className={`${styles.grid} ${styles.grid4}`}>
              <label className={styles.label}>
                <div className={styles.labelText}>体重</div>
                <input
                  className={styles.input}
                  value={character.weight || ''}
                  onChange={(e) => handleChange('weight', e.target.value)}
                />
              </label>
              <label className={styles.label}>
                <div className={styles.labelText}>瞳色</div>
                <input
                  className={styles.input}
                  value={character.eyes || character.eyeColor || ''}
                  onChange={(e) => {
                    handleChange('eyes', e.target.value);
                    handleChange('eyeColor', e.target.value);
                  }}
                />
              </label>
              <label className={styles.label}>
                <div className={styles.labelText}>肤色</div>
                <input
                  className={styles.input}
                  value={character.skin || character.skinColor || ''}
                  onChange={(e) => {
                    handleChange('skin', e.target.value);
                    handleChange('skinColor', e.target.value);
                  }}
                />
              </label>
              <label className={styles.label}>
                <div className={styles.labelText}>发色</div>
                <input
                  className={styles.input}
                  value={character.hair || character.hairColor || ''}
                  onChange={(e) => {
                    handleChange('hair', e.target.value);
                    handleChange('hairColor', e.target.value);
                  }}
                />
              </label>
            </div>

            <label className={styles.label}>
              <div className={styles.labelText}>外貌细节描述</div>
              <textarea
                className={`${styles.input} ${styles.textarea}`}
                value={character.appearance || ''}
                placeholder="描述角色的显著外貌特征、伤疤或饰品..."
                onChange={(e) => handleChange('appearance', e.target.value)}
              />
            </label>
          </div>

          {/* 背景与个性 */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>背景与个性</div>
            <label className={styles.label}>
              <div className={styles.labelText}>背景故事</div>
              <textarea
                className={`${styles.input} ${styles.textarea}`}
                style={{ minHeight: 180 }}
                value={character.backstory || ''}
                placeholder="讲述角色的过往经历..."
                onChange={(e) => handleChange('backstory', e.target.value)}
              />
            </label>

            <div className={`${styles.grid} ${styles.grid2}`}>
              <label className={styles.label}>
                <div className={styles.labelText}>人格特质</div>
                <textarea
                  className={`${styles.input} ${styles.textarea}`}
                  value={character.personalityTraits || ''}
                  onChange={(e) => handleChange('personalityTraits', e.target.value)}
                />
              </label>
              <label className={styles.label}>
                <div className={styles.labelText}>理想</div>
                <textarea
                  className={`${styles.input} ${styles.textarea}`}
                  value={character.ideals || ''}
                  onChange={(e) => handleChange('ideals', e.target.value)}
                />
              </label>
            </div>

            <div className={`${styles.grid} ${styles.grid2}`}>
              <label className={styles.label}>
                <div className={styles.labelText}>牵绊</div>
                <textarea
                  className={`${styles.input} ${styles.textarea}`}
                  value={character.bonds || ''}
                  onChange={(e) => handleChange('bonds', e.target.value)}
                />
              </label>
              <label className={styles.label}>
                <div className={styles.labelText}>缺点</div>
                <textarea
                  className={`${styles.input} ${styles.textarea}`}
                  value={character.flaws || ''}
                  onChange={(e) => handleChange('flaws', e.target.value)}
                />
              </label>
            </div>
          </div>

          {/* 社交与组织 */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>社交与组织</div>
            <div className={`${styles.grid} ${styles.grid1}`}>
              <label className={styles.label}>
                <div className={styles.labelText}>所属组织</div>
                <input
                  className={styles.input}
                  value={character.organizations || ''}
                  onChange={(e) => handleChange('organizations', e.target.value)}
                />
              </label>
            </div>
            <div className={`${styles.grid} ${styles.grid2}`}>
              <label className={styles.label}>
                <div className={styles.labelText}>盟友</div>
                <textarea
                  className={`${styles.input} ${styles.textarea}`}
                  value={character.allies || ''}
                  onChange={(e) => handleChange('allies', e.target.value)}
                />
              </label>
              <label className={styles.label}>
                <div className={styles.labelText}>敌人</div>
                <textarea
                  className={`${styles.input} ${styles.textarea}`}
                  value={character.enemies || ''}
                  onChange={(e) => handleChange('enemies', e.target.value)}
                />
              </label>
            </div>
            <label className={styles.label}>
              <div className={styles.labelText}>其他笔记</div>
              <textarea
                className={`${styles.input} ${styles.textarea}`}
                value={character.otherNotes || ''}
                onChange={(e) => handleChange('otherNotes', e.target.value)}
              />
            </label>
          </div>

          <div className={styles.actions}>
            <PillButton
              variant="outline"
              onClick={() => router.push(`/builder/alignment?id=${id}`)}
            >
              返回上一步
            </PillButton>
            <PillButton
              size="lg"
              onClick={() => id && router.push(`/sheet/view/?id=${encodeURIComponent(id)}`)}
            >
              完成创建，进入角色卡
            </PillButton>
          </div>
        </div>
      </div>
    </div>
  );
}
