import React, { useState } from 'react';
import styles from '../../sheet.module.css';
import PillButton from '@/components/PillButton';
import MarkdownText from '@/components/MarkdownText';
import {
  getSpeciesDefinition,
  getBackgroundDefinition,
  getClassDefinition,
  getSubclassDefinition,
  getFeatDefinition,
  getSpellDefinition,
} from '@/engine/characterData';
import {
  formatActionType,
  translateAbilityKey,
  translateSkill,
  translateProficiency,
} from '@/engine/terminology';
import { computeAbilityScores } from '@/engine/ability';
import { getCatalogCharacterOptions } from '@/catalog';

const FeatureDetailItem = ({ feature }: { feature: any }) => {
  const hasDescription = feature.description && feature.description.trim().length > 0;
  const passiveEffects = feature.features?.passiveEffects || [];
  const combinedTraits = feature.combinedTraits || [];

  return (
    <div
      style={{
        padding: '20px 24px',
        background: 'var(--color-bg-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border-dark)',
        boxShadow: 'var(--shadow-subtle)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <strong
              style={{
                fontSize: 17,
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-family-serif)',
              }}
            >
              {feature.name}
            </strong>
            {feature.category && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--color-gold-bright)',
                  border: '1px solid var(--color-border-gold)',
                  background: 'rgba(197, 160, 89, 0.1)',
                  padding: '1px 6px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {feature.category === 'Origin'
                  ? '起源专长'
                  : feature.category === 'General'
                    ? '通用专长'
                    : feature.category === 'Fighting Style'
                      ? '战斗风格'
                      : feature.category === 'Epic Boon'
                        ? '史诗恩惠'
                        : feature.category === 'Subspecies' || feature.category === '亚种'
                          ? '亚种特性'
                          : feature.category}
              </span>
            )}
          </div>
          {feature.nameEn && (
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {feature.nameEn}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {feature.type && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color:
                  feature.type === '子职业'
                    ? 'var(--color-accent-arcane)'
                    : 'var(--color-text-secondary)',
                background:
                  feature.type === '子职业' ? 'rgba(124, 58, 237, 0.15)' : 'var(--color-bg-dark)',
                padding: '2px 8px',
                borderRadius: 6,
                border: '1px solid var(--color-border-dark)',
              }}
            >
              {feature.sourceName || feature.type}
            </span>
          )}
          {feature.level && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: 'var(--color-gold-bright)',
                background: 'rgba(197, 160, 89, 0.12)',
                border: '1px solid var(--color-border-gold)',
                padding: '2px 8px',
                borderRadius: 6,
              }}
            >
              等级 {feature.level}
            </span>
          )}
          {feature.action && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                background: 'var(--color-bg-dark)',
                border: '1px solid var(--color-border-dark)',
                padding: '2px 8px',
                borderRadius: 6,
              }}
            >
              {formatActionType(feature.action)}
            </span>
          )}
          {feature.usage && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                background: 'var(--color-bg-dark)',
                border: '1px solid var(--color-border-dark)',
                padding: '2px 8px',
                borderRadius: 6,
              }}
            >
              {feature.usage.limit === 'Proficiency Bonus' ? '熟练加值' : feature.usage.limit}次 /{' '}
              {feature.usage.recovery === 'Long Rest'
                ? '长休'
                : feature.usage.recovery === 'Short Rest'
                  ? '短休'
                  : '休整'}
            </span>
          )}
        </div>
      </div>

      {feature.prerequisite && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--color-text-secondary)',
            marginBottom: 12,
            padding: '4px 8px',
            background: 'var(--color-bg-dark)',
            border: '1px solid var(--color-border-dark)',
            borderRadius: 6,
            display: 'inline-block',
          }}
        >
          <strong>前提条件:</strong> {feature.prerequisite}
        </div>
      )}

      <div
        style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7, margin: 0 }}
      >
        {hasDescription ? (
          <div className="feature-description">
            {feature.description.split('\n\n> **已选项目').map((part: string, i: number) => {
              if (i === 0) return <MarkdownText key={i} text={part} variant="clean" />;

              // 提取已选项并进行高级 UI 渲染
              const fullPart = part.trim();
              const [labelPart, ...rest] = fullPart.split('**：**');
              const selectionText = rest.join('**：**') || labelPart;

              // 检查是否为列表项 (以 - 或 * 开头)
              const items = selectionText
                .split('\n')
                .filter(
                  (line) =>
                    line.trim().startsWith('-') ||
                    line.trim().startsWith('*') ||
                    line.trim().startsWith('> -'),
                );
              const isLongList = items.some((item) => item.length > 50);

              return (
                <div
                  key={i}
                  style={{
                    marginTop: '16px',
                    padding: '14px 18px',
                    background: 'rgba(197, 160, 89, 0.05)',
                    borderRadius: '12px',
                    border: '1px solid var(--color-border-dark)',
                    borderLeft: '4px solid var(--color-gold-bright)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        color: 'var(--color-gold-bright)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                      }}
                    >
                      已完成选择
                    </div>
                  </div>

                  <div style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>
                    {items.length > 0 && !isLongList ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {items.map((item, idx) => {
                          const cleanItem = item
                            .replace(/^(\s*[-*>]+\s*)/, '')
                            .replace(/\*\*/g, '')
                            .trim();
                          return (
                            <span
                              key={idx}
                              style={{
                                background: 'var(--color-bg-dark)',
                                padding: '4px 12px',
                                borderRadius: '20px',
                                border: '1px solid var(--color-border-gold)',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: 'var(--color-gold-bright)',
                              }}
                            >
                              {cleanItem}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ fontWeight: 500, lineHeight: 1.6 }}>
                        <MarkdownText text={selectionText} variant="clean" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          passiveEffects.length === 0 &&
          combinedTraits.length === 0 && (
            <span style={{ fontStyle: 'italic', opacity: 0.5 }}>（无具体描述内容）</span>
          )
        )}

        {/* 渲染被合并的机械效果或被动效果 */}
        {(passiveEffects.length > 0 || combinedTraits.length > 0) && (
          <div
            style={{
              marginTop: hasDescription ? 12 : 0,
              padding: '10px 14px',
              background: 'rgba(0,0,0,0.025)',
              borderRadius: 8,
              borderLeft: '3px solid var(--color-primary-subtle)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--color-text-tertiary)',
                marginBottom: 6,
                textTransform: 'uppercase',
              }}
            >
              附加效果 & 机制 Effects
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {passiveEffects.map((effect: string, i: number) => (
                <li key={`p-${i}`} style={{ marginBottom: 2 }}>
                  {effect}
                </li>
              ))}
              {combinedTraits.map((trait: any, i: number) => (
                <React.Fragment key={`c-${i}`}>
                  {trait.features?.passiveEffects?.map((effect: string, j: number) => (
                    <li key={`c-${i}-${j}`} style={{ marginBottom: 2 }}>
                      {trait.name !== feature.name ? <strong>{trait.name}: </strong> : null}
                      {effect}
                      {trait.action && (
                        <span style={{ marginLeft: 8, opacity: 0.7, fontSize: 11 }}>
                          [{formatActionType(trait.action)}]
                        </span>
                      )}
                    </li>
                  ))}
                </React.Fragment>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

interface FeaturesTabProps {
  character: any;
  router: any;
  id: string;
  activeCategory: '种族' | '职业' | '背景' | '专长' | '附加选项';
  onUpdateResource: (name: string, value: number) => void;
}

const FeaturesTab: React.FC<FeaturesTabProps> = ({
  character,
  router,
  id,
  activeCategory,
  onUpdateResource,
}) => {
  const species = getSpeciesDefinition(character);
  const background = getBackgroundDefinition(character);
  const primaryClassEntry = character.classes[0];
  const primaryClass = primaryClassEntry ? getClassDefinition(primaryClassEntry.classId) : null;
  const subclass = getSubclassDefinition(character);
  const classLevel = primaryClassEntry?.level || 0;
  const characterOptions = getCatalogCharacterOptions()
    .filter((option) => (character.selectedCharacterOptionIds || []).includes(option.id))
    .map((option) => ({
      ...option,
      category: option.type || option.kind,
      prerequisite: option.prerequisites.length ? JSON.stringify(option.prerequisites) : undefined,
      type: option.automationStatus === 'manual' ? '原文/人工处理' : '结构化机制',
      sourceName: option.source,
    }));

  const renderFeatureSection = (
    title: string,
    enTitle: string,
    features: any[],
    editPath: string,
    isEmpty: boolean,
    headerContent?: React.ReactNode,
    groupByCategory: boolean = false,
  ) => (
    <div className={styles.card} style={{ padding: 24, minHeight: 400 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
          {title}{' '}
          <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)', fontWeight: 400 }}>
            {enTitle}
          </span>
        </h2>
        <PillButton size="sm" variant="outline" onClick={() => router.push(editPath)}>
          重选 / 编辑
        </PillButton>
      </div>

      {headerContent && !isEmpty && <div style={{ marginBottom: 24 }}>{headerContent}</div>}

      {isEmpty ? (
        <div
          style={{
            textAlign: 'center',
            padding: '80px 0',
            background: 'var(--color-bg-light)',
            borderRadius: 16,
            border: '1px dashed var(--color-border-subtle)',
          }}
        >
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: 15, marginBottom: 20 }}>
            还没有完成{title}的选择
          </p>
          <PillButton size="md" onClick={() => router.push(editPath)}>
            前往构建器
          </PillButton>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {groupByCategory ? (
            // 分组渲染 (主要用于职业等级)
            (() => {
              const groups: Record<number, any[]> = {};
              features.forEach((f) => {
                const lvl = f.level || 1;
                if (!groups[lvl]) groups[lvl] = [];
                groups[lvl].push(f);
              });
              return Object.entries(groups)
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([lvl, fs]) => (
                  <div key={lvl}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}
                    >
                      <div
                        style={{
                          height: 1,
                          flex: 1,
                          background:
                            'linear-gradient(to right, transparent, var(--color-border-subtle))',
                        }}
                      ></div>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'var(--color-text-tertiary)',
                          background: 'var(--color-bg-light)',
                          padding: '2px 10px',
                          borderRadius: 20,
                          border: '1px solid var(--color-border-subtle)',
                        }}
                      >
                        等级 {lvl}
                      </span>
                      <div
                        style={{
                          height: 1,
                          flex: 1,
                          background:
                            'linear-gradient(to left, transparent, var(--color-border-subtle))',
                        }}
                      ></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                      {fs.map((f, i) => (
                        <FeatureDetailItem key={i} feature={f} />
                      ))}
                    </div>
                  </div>
                ));
            })()
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
              {features.map((f, idx) => (
                <FeatureDetailItem key={idx} feature={f} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // 1. 种族特性处理逻辑
  const getSpeciesFeaturesList = () => {
    if (!species) return [];
    const list: any[] = [];

    // 1.1 处理基础种族特质
    const resolveSelection = (traitId: string, features?: any) => {
      if (!character.speciesSelections) return [];

      const possibleKeys = [
        traitId,
        `sp:${species.id}:trait:${traitId}`,
        `sp:${species.id}:trait:${traitId}:skill`,
        `sp:${species.id}:trait:${traitId}:tool`,
        `sp:${species.id}:trait:${traitId}:language`,
        `sp:${species.id}:trait:${traitId}:size`,
        `sp:${species.id}:trait:${traitId}:feat`,
        `sp:${species.id}:trait:${traitId}:resist`,
        `sp:${species.id}:trait:${traitId}:resist-0`,
      ];

      if (features?.mechanics?.choices) {
        features.mechanics.choices.forEach((c: any) => {
          if (c.id && !possibleKeys.includes(c.id)) possibleKeys.push(c.id);
        });
      }

      for (const key of possibleKeys) {
        if (character.speciesSelections[key]) return character.speciesSelections[key];
      }

      const fuzzyMatch = Object.entries(character.speciesSelections).find(([k]) =>
        k.includes(`trait:${traitId}`),
      );
      if (fuzzyMatch) return fuzzyMatch[1];

      return [];
    };

    // 1.2 处理亚种与变体覆盖关系
    const subspeciesDef = species.subSpecies?.options.find(
      (o: any) => o.id === character.subspeciesId,
    );
    const overwrittenNames = new Set<string>();
    if (subspeciesDef?.traits) {
      subspeciesDef.traits.forEach((st) => {
        if (st.overwrite) {
          overwrittenNames.add(st.overwrite.toLowerCase().replace(/[-_\s]+/g, ''));
        }
      });
    }

    (species.traits || []).forEach((trait) => {
      const tName = (trait.name || '').toLowerCase().replace(/[-_\s]+/g, '');
      const tNameEn = (trait.nameEn || '').toLowerCase().replace(/[-_\s]+/g, '');
      if (overwrittenNames.has(tName) || (tNameEn && overwrittenNames.has(tNameEn))) {
        return; // 母特质已被亚种/变体特质替代，不重复呈现
      }

      const traitId = trait.id || trait.name;
      const selections = resolveSelection(traitId, trait);
      let resolvedDescription = trait.description;

      if (selections && Array.isArray(selections) && selections.length > 0) {
        const choiceText = selections
          .map((s) => {
            const translated =
              translateSkill(s) !== s
                ? translateSkill(s)
                : translateProficiency(s) !== s
                  ? translateProficiency(s).split(' (')[0]
                  : s;
            return `**${translated}**`;
          })
          .join(', ');
        resolvedDescription = `${resolvedDescription}\n\n> **已选项目：** ${choiceText}`;
      }

      list.push({ ...trait, description: resolvedDescription });
    });
    if (subspeciesDef) {
      const mainSubFeature: any = {
        ...subspeciesDef,
        category: '亚种',
        combinedTraits: [],
      };

      if (subspeciesDef.traits) {
        subspeciesDef.traits.forEach((st) => {
          const selected = resolveSelection(st.id || st.name, st);
          if (selected.length) {
            list.push({
              ...st,
              category: '亚种能力',
              description: `${st.description}\n\n> **已选项目：** ${selected.join('、')}`,
            });
            return;
          }
          if (!st.description || st.description.trim().length === 0) {
            mainSubFeature.combinedTraits.push(st);
            if (st.action && !mainSubFeature.action) mainSubFeature.action = st.action;
            if (st.usage && !mainSubFeature.usage) mainSubFeature.usage = st.usage;
          } else {
            list.push({ ...st, category: '亚种能力' });
          }
        });
      }
      list.push(mainSubFeature);
    }

    return list.filter(
      (f) =>
        f.name && (f.description || f.features?.passiveEffects || f.combinedTraits?.length > 0),
    );
  };

  const speciesFeatures = getSpeciesFeaturesList();

  let speciesSpeed = species?.speed || 0;
  let speciesSenses = { ...species?.senses };
  [
    ...(species?.traits || []),
    ...(species?.subSpecies?.options.find((o) => o.id === character.subspeciesId)?.traits || []),
  ].forEach((t: any) => {
    if (t.features?.speedBonus) speciesSpeed += t.features.speedBonus;
    if (t.features?.senseUpgrade) {
      Object.entries(t.features.senseUpgrade).forEach(([k, v]) => {
        if ((speciesSenses as any)[k] === undefined || (speciesSenses as any)[k] < (v as number)) {
          (speciesSenses as any)[k] = v;
        }
      });
    }
  });

  const speciesHeader = species ? (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 16,
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          background: 'var(--color-bg-dark)',
          borderRadius: 12,
          border: '1px solid var(--color-border-dark)',
          boxShadow: 'var(--shadow-subtle)',
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: 'var(--color-text-secondary)',
            marginBottom: 6,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            fontFamily: 'var(--font-family-serif)',
          }}
        >
          基础速度 Speed
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--color-gold-bright)',
            display: 'flex',
            alignItems: 'baseline',
            gap: 4,
          }}
        >
          {speciesSpeed}{' '}
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
            尺
          </span>
        </div>
      </div>
      <div
        style={{
          padding: '16px 20px',
          background: 'var(--color-bg-dark)',
          borderRadius: 12,
          border: '1px solid var(--color-border-dark)',
          boxShadow: 'var(--shadow-subtle)',
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: 'var(--color-text-secondary)',
            marginBottom: 6,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            fontFamily: 'var(--font-family-serif)',
          }}
        >
          体型 Size
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-gold-bright)' }}>
          {character.size
            ? character.size === 'Medium'
              ? '中型'
              : character.size === 'Small'
                ? '小型'
                : character.size
            : Array.isArray(species.size)
              ? species.size
                  .map((s) => (s === 'Medium' ? '中型' : s === 'Small' ? '小型' : s))
                  .join('/')
              : (species.size as any) === 'Medium'
                ? '中型'
                : (species.size as any) === 'Small'
                  ? '小型'
                  : species.size}
        </div>
      </div>
      {Object.keys(speciesSenses).length > 0 && (
        <div
          style={{
            padding: '16px 20px',
            background: 'var(--color-bg-dark)',
            borderRadius: 12,
            border: '1px solid var(--color-border-dark)',
            boxShadow: 'var(--shadow-subtle)',
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              marginBottom: 6,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
              fontFamily: 'var(--font-family-serif)',
            }}
          >
            感官 Senses
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--color-gold-bright)',
              lineHeight: 1.4,
            }}
          >
            {Object.entries(speciesSenses)
              .map(([k, v]) => `${k === 'darkvision' ? '黑暗视觉' : k} ${v}尺`)
              .join(', ')}
          </div>
        </div>
      )}
    </div>
  ) : null;

  // 2. 职业特性处理逻辑
  const getClassFeaturesList = () => {
    if (!primaryClass) return [];

    // 2.1 收集基础职业特性与子职业特性
    const rawList: any[] = (primaryClass.features || [])
      .filter((f: any) => f.level <= classLevel)
      .filter((f: any) => {
        const isPlaceholder =
          f.name === '子职特性' ||
          f.name === '战士子职' ||
          f.name === '子职业' ||
          f.nameEn === 'Subclass Feature' ||
          f.nameEn === 'Fighter Subclass';

        return !subclass || !isPlaceholder;
      })
      .map((f: any) => ({ ...f, type: '职业' }));

    if (subclass) {
      const subclassFeatures = (subclass.traits || [])
        .filter((f: any) => f.level <= classLevel)
        .map((f: any) => ({
          ...f,
          name: f.name,
          nameEn: f.nameEn ? `${f.nameEn} (${subclass.nameEn || subclass.name})` : undefined,
          type: '子职业',
          sourceName: subclass.name,
        }));
      rawList.push(...subclassFeatures);
    }

    // 2.2 收集专长
    const slotFeats = (character.selectedFeats || [])
      .filter((f: any) => f.classId === primaryClass.nameEn && f.level <= classLevel)
      .map((f: any) => {
        const featDef = getFeatDefinition(f.featId);
        return featDef
          ? {
              ...featDef,
              level: f.level,
              type: '职业专长',
              category: featDef.category || 'General',
            }
          : null;
      })
      .filter(Boolean);

    rawList.push(...slotFeats);

    // 2.3 解析选择
    const resolveClassSelection = (feature: any, choice: any) => {
      if (!character.classSelections) return [];

      const traitId = feature.id || feature.name;
      const traitName = feature.name;
      const level = feature.level;

      const possibleKeys = [
        `cls:${primaryClass.nameEn}:feat:${traitName}:${choice.id}`,
        `cls:${primaryClass.nameEn}:${traitId}:${choice.id}`,
        `${choice.id}_lvl${level}`,
        `${traitId}_lvl${level}`,
        choice.id,
        `${primaryClass.nameEn}:${traitId}:${choice.id}`,
        `${primaryClass.nameEn}:${traitId}`,
        traitId,
      ];

      for (const key of possibleKeys) {
        if (character.classSelections[key]) return character.classSelections[key];
      }

      const fuzzyMatch = Object.entries(character.classSelections).find(
        ([k]) =>
          (k.includes(choice.id) && (k.includes(traitId) || k.includes(traitName))) ||
          (k.includes(choice.id) && k.includes(`lvl${level}`)),
      );

      if (fuzzyMatch) return fuzzyMatch[1];
      return [];
    };

    const resolvedList = rawList.map((feature) => {
      const choices = feature.mechanics?.choices || [];
      if (choices.length === 0) return feature;

      let extraDescription = '';
      choices.forEach((choice: any) => {
        const selected = resolveClassSelection(feature, choice);
        if (selected && Array.isArray(selected) && selected.length > 0) {
          const selectedDetails = selected.map((val) => {
            const feat = getFeatDefinition(val);
            if (feat) return { name: feat.name, description: feat.description };

            const localOption = (feature.options || []).find(
              (o: any) =>
                typeof o === 'object' && (o.id === val || o.nameEn === val || o.name === val),
            );
            if (localOption && typeof localOption === 'object') {
              return { name: localOption.name, description: localOption.description };
            }

            const translated =
              translateSkill(val) !== val
                ? translateSkill(val)
                : translateProficiency(val) !== val
                  ? translateProficiency(val).split(' (')[0]
                  : val;
            return { name: translated, description: '' };
          });

          const label = choice.name || (choice.id?.includes('prof') ? '熟练项' : '选择');
          extraDescription += `\n\n> **已选项目 (${label})：**\n${selectedDetails.map((d) => `> - **${d.name}**${d.description ? `\n>   ${d.description.replace(/\n/g, '\n>   ')}` : ''}`).join('\n')}`;
        }
      });

      return {
        ...feature,
        description: feature.description + extraDescription,
      };
    });

    return resolvedList.sort((a, b) => a.level - b.level);
  };

  const classFeatures = getClassFeaturesList();

  const classHeader = primaryClass ? (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      <div
        style={{
          padding: '12px 16px',
          background: 'var(--color-bg-light)',
          borderRadius: 12,
          border: '1px solid var(--color-border-subtle)',
          flex: 1,
          minWidth: 150,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: 'var(--color-text-tertiary)',
            marginBottom: 4,
            fontWeight: 600,
          }}
        >
          生命骰 Hit Die
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          d{primaryClass.hitPointDie}
        </div>
      </div>
      <div
        style={{
          padding: '12px 16px',
          background: 'var(--color-bg-light)',
          borderRadius: 12,
          border: '1px solid var(--color-border-subtle)',
          flex: 2,
          minWidth: 200,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: 'var(--color-text-tertiary)',
            marginBottom: 4,
            fontWeight: 600,
          }}
        >
          豁免熟练 Saving Throws
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            display: 'flex',
            gap: 8,
          }}
        >
          {primaryClass.proficiencies?.savingThrows?.map((s: string) => (
            <span
              key={s}
              style={{
                background: 'var(--color-bg-subtle)',
                color: 'var(--color-primary)',
                padding: '1px 8px',
                borderRadius: 6,
              }}
            >
              {translateAbilityKey(s)}
            </span>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  // 3. 背景特性
  const backgroundFeatures = (() => {
    if (!background) return [];
    const list: any[] = [];
    list.push({
      name: background.name,
      nameEn: background.nameEn,
      description: background.description,
      type: '背景',
    });
    if (background.feat) {
      const fullFeat = getFeatDefinition(background.feat.nameEn) || background.feat;
      list.push({
        ...fullFeat,
        category: 'Origin',
        type: '起源专长',
      });
    }
    return list;
  })();

  const bgAsi = character.backgroundAbilityBonuses || {};
  const bgAsiString = Object.entries(bgAsi)
    .map(([k, v]) => `${translateAbilityKey(k)} +${v}`)
    .join(', ');

  const getBgProficiencies = () => {
    if (!background) return [];
    const profs: string[] = [];
    background.skillProficiencies?.forEach((s: any, i: number) => {
      if (typeof s === 'string') profs.push(translateSkill(s));
      else {
        const selected = character.backgroundSelections?.[`bg:${background.id}:prof:skill:${i}`];
        if (selected) selected.forEach((v: string) => profs.push(translateSkill(v)));
      }
    });
    background.toolProficiencies?.forEach((t: any, i: number) => {
      if (typeof t === 'string') profs.push(translateProficiency(t).split(' (')[0]);
      else {
        const selected = character.backgroundSelections?.[`bg:${background.id}:prof:tool:${i}`];
        if (selected)
          selected.forEach((v: string) => profs.push(translateProficiency(v).split(' (')[0]));
      }
    });
    background.languages?.forEach((l: any, i: number) => {
      if (typeof l === 'string') profs.push(l);
      else {
        const key = `bg:${background.id}:prof:lang:${i}`;
        const selected =
          character.backgroundSelections?.[key] || character.backgroundSelections?.[`bg:lang:${i}`];
        if (selected) selected.forEach((v: string) => profs.push(v));
      }
    });
    return profs;
  };

  const bgProfs = getBgProficiencies();

  const backgroundHeader = background ? (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          background: 'var(--color-bg-dark)',
          borderRadius: 12,
          border: '1px solid var(--color-border-dark)',
          boxShadow: 'var(--shadow-subtle)',
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: 'var(--color-text-secondary)',
            marginBottom: 6,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            fontFamily: 'var(--font-family-serif)',
          }}
        >
          属性值加成 Ability Bonuses
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-gold-bright)' }}>
          {bgAsiString || '无'}
        </div>
      </div>
      <div
        style={{
          padding: '16px 20px',
          background: 'var(--color-bg-dark)',
          borderRadius: 12,
          border: '1px solid var(--color-border-dark)',
          boxShadow: 'var(--shadow-subtle)',
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: 'var(--color-text-secondary)',
            marginBottom: 6,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            fontFamily: 'var(--font-family-serif)',
          }}
        >
          背景熟练项 Proficiencies
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px 10px',
          }}
        >
          {bgProfs.length > 0
            ? bgProfs.map((p, i) => (
                <span
                  key={i}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--color-border-dark)',
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontSize: '13px',
                  }}
                >
                  {p}
                </span>
              ))
            : '无'}
        </div>
      </div>
    </div>
  ) : null;

  // 4. 专长 (合并所有来源)
  const allFeats: any[] = [];
  const processedFeatIds = new Set<string>();

  // 4.1 来自背景的起源专长
  if (background?.feat) {
    const featId = background.feat.nameEn || background.feat.name;
    const featDef = getFeatDefinition(featId);
    if (featDef) {
      allFeats.push({
        ...featDef,
        level: 1,
        type: '背景起源专长',
        category: 'Origin',
        sourceName: background.name,
      });
      processedFeatIds.add(featId);
    }
  }

  // 4.2 来自种族的专长 (例如人类、歌利亚)
  if (character.speciesSelections) {
    Object.entries(character.speciesSelections).forEach(([key, val]) => {
      const isSpeciesFeat = species?.traits.some(
        (trait) =>
          trait.features?.originFeats && key === `sp:${species.id}:trait:${trait.id || trait.name}`,
      );
      if (
        (isSpeciesFeat || key.includes(':feat') || key.includes('trait:feat')) &&
        Array.isArray(val)
      ) {
        val.forEach((featId) => {
          if (!processedFeatIds.has(featId)) {
            const featDef = getFeatDefinition(featId);
            if (featDef) {
              allFeats.push({
                ...featDef,
                level: 1,
                type: '种族起源专长',
                category: featDef.category || 'Origin',
                sourceName: species?.name || '种族',
              });
              processedFeatIds.add(featId);
            }
          }
        });
      }
    });
  }

  // 4.3 来自职业等级获取的专长 (新版精细化数据 featSelections)
  if (character.featSelections) {
    Object.entries(character.featSelections).forEach(([slotId, choices]: [string, any]) => {
      const featId = choices.featId;
      const featDef = getFeatDefinition(featId);
      if (featDef) {
        const levelMatch = slotId.match(/lvl(\d+)/);
        const level = levelMatch ? parseInt(levelMatch[1]) : undefined;

        allFeats.push({
          ...featDef,
          level: level,
          type: '等级专长',
          category: featDef.category || 'General',
          selections: choices,
          sourceName: '职业等级',
        });
        processedFeatIds.add(featId);
      }
    });
  }

  // 4.4 兼容旧版数据 (selectedFeats)
  if (character.selectedFeats) {
    character.selectedFeats.forEach((sf: any) => {
      if (!processedFeatIds.has(sf.featId)) {
        const featDef = getFeatDefinition(sf.featId);
        if (featDef) {
          allFeats.push({
            ...featDef,
            level: sf.level,
            type: '已选专长',
            category: featDef.category || 'General',
            sourceName: sf.classId || '职业',
          });
          processedFeatIds.add(sf.featId);
        }
      }
    });
  }

  const selectedFeats = allFeats
    .map((feat: any) => {
      let resolvedDescription = feat.description;
      const selections = feat.selections;

      if (selections && typeof selections === 'object') {
        let choiceText = '';

        // 1. 属性提升
        if (selections.ability) {
          choiceText += `\n> - **属性提升**: ${translateAbilityKey(selections.ability)} +1`;
        }
        if (selections.asi) {
          Object.entries(selections.asi).forEach(([ab, val]) => {
            if (val) choiceText += `\n> - **属性提升**: ${translateAbilityKey(ab)} +${val}`;
          });
        }

        // 2. 技能与工具
        if (selections.skills && Array.isArray(selections.skills) && selections.skills.length > 0) {
          choiceText += `\n> - **技能熟练**: ${selections.skills.map((s: string) => translateSkill(s)).join(', ')}`;
        }
        if (
          selections.expertise &&
          Array.isArray(selections.expertise) &&
          selections.expertise.length > 0
        ) {
          choiceText += `\n> - **技能专精**: ${selections.expertise.map((s: string) => translateSkill(s)).join(', ')}`;
        }
        if (selections.tools && Array.isArray(selections.tools) && selections.tools.length > 0) {
          choiceText += `\n> - **工具熟练**: ${selections.tools.map((t: string) => translateProficiency(t).split('（')[0]).join(', ')}`;
        }

        // 3. 法术
        if (selections.spellList) {
          choiceText += `\n> - **所选法术列表**: ${selections.spellList}`;
        }
        if (selections.spells && Array.isArray(selections.spells) && selections.spells.length > 0) {
          const spellNames = selections.spells.map((s: string) => {
            const sDef = getSpellDefinition(s);
            return sDef ? (sDef.nameEn ? `${sDef.name} (${sDef.nameEn})` : sDef.name) : s;
          });
          choiceText += `\n> - **习得法术**: ${spellNames.join(', ')}`;
        }

        // 4. 语言与精通
        if (
          selections.languages &&
          Array.isArray(selections.languages) &&
          selections.languages.length > 0
        ) {
          choiceText += `\n> - **所学语言**: ${selections.languages.join(', ')}`;
        }
        if (
          selections.weaponMasteries &&
          Array.isArray(selections.weaponMasteries) &&
          selections.weaponMasteries.length > 0
        ) {
          choiceText += `\n> - **武器精通**: ${selections.weaponMasteries.map((w: string) => translateProficiency(w)).join(', ')}`;
        }

        if (choiceText) {
          resolvedDescription = `${resolvedDescription}\n\n> **已选项目：**${choiceText}`;
        }
      }

      return { ...feat, description: resolvedDescription };
    })
    .sort((a, b) => (a.level || 0) - (b.level || 0));

  // 资源逻辑
  const resources: { id: string; name: string; max: number; recovery: string }[] = [];
  const className = primaryClass?.nameEn?.toLowerCase() || '';
  const abilityScores = computeAbilityScores(character);
  const modifiers = abilityScores.modifiers;

  if (className === 'barbarian') {
    const rageMax =
      classLevel >= 20
        ? 999
        : classLevel >= 17
          ? 6
          : classLevel >= 12
            ? 5
            : classLevel >= 6
              ? 4
              : classLevel >= 3
                ? 3
                : 2;
    resources.push({ id: 'rage', name: '狂暴次数', max: rageMax, recovery: '长休' });
  }
  if (className === 'bard') {
    resources.push({
      id: 'bardicInspiration',
      name: '诗人激励',
      max: Math.max(1, modifiers.cha),
      recovery: classLevel >= 5 ? '短休/长休' : '长休',
    });
  }
  if (className === 'druid' && classLevel >= 2) {
    resources.push({
      id: 'wildShape',
      name: '荒野变形',
      max: classLevel >= 17 ? 4 : classLevel >= 6 ? 3 : 2,
      recovery: '短休/长休',
    });
  }
  if (className === 'fighter') {
    resources.push({
      id: 'secondWind',
      name: '回气',
      max: classLevel >= 10 ? 4 : classLevel >= 4 ? 3 : 2,
      recovery: '短休/长休',
    });
  }
  if (className === 'monk') {
    resources.push({ id: 'ki', name: '专注点 (气)', max: classLevel, recovery: '短休' });
  }
  if (className === 'sorcerer' && classLevel >= 2) {
    resources.push({ id: 'sorceryPoints', name: '术法点', max: classLevel, recovery: '长休' });
  }
  if (className === 'cleric' || className === 'paladin') {
    if (classLevel >= 2)
      resources.push({
        id: 'channelDivinity',
        name: '引导神力',
        max: classLevel >= 11 ? 3 : classLevel >= 6 ? 2 : 1,
        recovery: '短休',
      });
  }
  if (className === 'warlock') {
    const slots = classLevel >= 17 ? 4 : classLevel >= 11 ? 3 : classLevel >= 2 ? 2 : 1;
    const slotLvl =
      classLevel >= 9 ? 5 : classLevel >= 7 ? 4 : classLevel >= 5 ? 3 : classLevel >= 3 ? 2 : 1;
    resources.push({
      id: 'pactMagic',
      name: `契约位 (${slotLvl}环)`,
      max: slots,
      recovery: '短休',
    });
    if (classLevel >= 2)
      resources.push({ id: 'magicalCunning', name: '秘法回流', max: 1, recovery: '长休' });
    if (classLevel >= 11)
      resources.push({ id: 'arcanum6', name: '玄奥秘法 (6环)', max: 1, recovery: '长休' });
    if (classLevel >= 13)
      resources.push({ id: 'arcanum7', name: '玄奥秘法 (7环)', max: 1, recovery: '长休' });
    if (classLevel >= 15)
      resources.push({ id: 'arcanum8', name: '玄奥秘法 (8环)', max: 1, recovery: '长休' });
    if (classLevel >= 17)
      resources.push({ id: 'arcanum9', name: '玄奥秘法 (9环)', max: 1, recovery: '长休' });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {activeCategory === '职业' && resources.length > 0 && (
        <div className={styles.card} style={{ padding: 20 }}>
          <div className={styles.trackerGrid}>
            {resources.map((res) => {
              const used = character.resourceUsage?.[res.id] || 0;
              const remaining = res.max === 999 ? '∞' : res.max - used;
              return (
                <div key={res.id} className={styles.trackerItem}>
                  <div className={styles.trackerLabel}>{res.name}</div>
                  <div className={styles.trackerValue}>
                    {remaining} / {res.max === 999 ? '∞' : res.max}
                  </div>
                  <div className={styles.bubbleRow}>
                    <PillButton
                      size="sm"
                      variant="outline"
                      onClick={() => onUpdateResource(res.id, Math.max(0, used - 1))}
                    >
                      恢复
                    </PillButton>
                    <PillButton
                      size="sm"
                      onClick={() => onUpdateResource(res.id, Math.min(res.max, used + 1))}
                    >
                      消耗
                    </PillButton>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 8 }}>
                    恢复周期: {res.recovery}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div key={activeCategory} style={{ animation: 'fadeIn 0.3s ease' }}>
        {activeCategory === '种族' &&
          renderFeatureSection(
            '种族特质',
            'Species Traits',
            speciesFeatures,
            `/builder/species?id=${id}`,
            !species,
            speciesHeader,
          )}
        {activeCategory === '职业' &&
          renderFeatureSection(
            '职业特性',
            'Class Features',
            classFeatures,
            `/builder/class?id=${id}`,
            !primaryClass,
            classHeader,
            true,
          )}
        {activeCategory === '背景' &&
          renderFeatureSection(
            '背景特性',
            'Background Feature',
            backgroundFeatures,
            `/builder/background?id=${id}`,
            !background,
            backgroundHeader,
          )}
        {activeCategory === '专长' &&
          renderFeatureSection(
            '已选专长',
            'Feats',
            selectedFeats,
            `/builder/feats?id=${id}`,
            selectedFeats.length === 0,
          )}
        {activeCategory === '附加选项' &&
          renderFeatureSection(
            '附加角色选项',
            'Character Options & Rewards',
            characterOptions,
            `/builder/character-options?id=${id}`,
            characterOptions.length === 0,
          )}
      </div>
    </div>
  );
};

export default FeaturesTab;
