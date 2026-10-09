import React, { useState } from 'react';
import styles from '../../sheet.module.css';
import PillButton from '@/components/PillButton';

interface AdventureTabProps {
  character: any;
  updateActiveCharacter: (data: any) => void;
}

const AdventureTab: React.FC<AdventureTabProps> = ({ character, updateActiveCharacter }) => {
  const [newLog, setNewLog] = useState('');
  const [newQuest, setNewQuest] = useState('');

  const logs = character.adventureLogs || [];
  const quests = character.quests || [];

  const addLog = () => {
    if (!newLog.trim()) return;
    const log = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toLocaleDateString(),
      content: newLog,
    };
    updateActiveCharacter({ adventureLogs: [log, ...logs] });
    setNewLog('');
  };

  const deleteLog = (id: string) => {
    updateActiveCharacter({ adventureLogs: logs.filter((l: any) => l.id !== id) });
  };

  const addQuest = () => {
    if (!newQuest.trim()) return;
    const quest = {
      id: Math.random().toString(36).substr(2, 9),
      title: newQuest,
      completed: false,
    };
    updateActiveCharacter({ quests: [...quests, quest] });
    setNewQuest('');
  };

  const toggleQuest = (id: string) => {
    updateActiveCharacter({
      quests: quests.map((q: any) => (q.id === id ? { ...q, completed: !q.completed } : q)),
    });
  };

  const deleteQuest = (id: string) => {
    updateActiveCharacter({ quests: quests.filter((q: any) => q.id !== id) });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 冒险日志 */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>冒险日志</h2>

        <div style={{ marginBottom: 20 }}>
          <textarea
            placeholder="记录今天的冒险..."
            value={newLog}
            onChange={(e) => setNewLog(e.target.value)}
            style={{
              width: '100%',
              height: 80,
              padding: 12,
              borderRadius: 8,
              border: '1px solid var(--color-border-subtle)',
              background: 'var(--color-bg-light)',
              fontSize: 14,
              resize: 'none',
              marginBottom: 8,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <PillButton size="sm" onClick={addLog}>
              发布日志
            </PillButton>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {logs.map((log: any) => (
            <div
              key={log.id}
              style={{
                padding: 16,
                background: 'var(--color-bg-light)',
                borderRadius: 12,
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span
                  style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontWeight: 600 }}
                >
                  {log.date}
                </span>
                <button
                  onClick={() => deleteLog(log.id)}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: 'var(--color-danger)',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  删除
                </button>
              </div>
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: 'var(--color-text-secondary)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {log.content}
              </div>
            </div>
          ))}
          {logs.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '20px',
                color: 'var(--color-text-tertiary)',
                fontSize: 14,
              }}
            >
              尚未记录任何冒险见闻
            </div>
          )}
        </div>
      </div>

      {/* 任务线索 */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>任务与线索</h2>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            placeholder="新增任务或线索..."
            value={newQuest}
            onChange={(e) => setNewQuest(e.target.value)}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--color-border-subtle)',
              background: 'var(--color-bg-light)',
              fontSize: 14,
            }}
            onKeyPress={(e) => e.key === 'Enter' && addQuest()}
          />
          <PillButton size="sm" onClick={addQuest}>
            添加
          </PillButton>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {quests.map((quest: any) => (
            <div
              key={quest.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                background: quest.completed ? 'rgba(52, 199, 89, 0.05)' : 'var(--color-bg-light)',
                borderRadius: 8,
                border: `1px solid ${quest.completed ? 'var(--color-success)' : 'var(--color-border-subtle)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <input
                  type="checkbox"
                  checked={quest.completed}
                  onChange={() => toggleQuest(quest.id)}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <span
                  style={{
                    fontSize: 14,
                    color: quest.completed
                      ? 'var(--color-text-tertiary)'
                      : 'var(--color-text-primary)',
                    textDecoration: quest.completed ? 'line-through' : 'none',
                  }}
                >
                  {quest.title}
                </span>
              </div>
              <button
                onClick={() => deleteQuest(quest.id)}
                style={{
                  border: 'none',
                  background: 'none',
                  color: 'var(--color-text-tertiary)',
                  fontSize: 12,
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                ✕
              </button>
            </div>
          ))}
          {quests.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '10px',
                color: 'var(--color-text-tertiary)',
                fontSize: 14,
              }}
            >
              暂无追踪的任务线索
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdventureTab;
