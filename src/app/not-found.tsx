'use client';

import React from 'react';
import Link from 'next/link';
import GlassNav from '@/components/GlassNav';
import { Compass, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg-base, #0b0c10)',
        color: 'var(--color-text-primary, #f0e6d2)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <GlassNav title="页面未找到" backLabel="返回首页" backHref="/" />

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            background: 'rgba(18, 22, 34, 0.8)',
            border: '1px solid var(--color-border-gold, rgba(197, 160, 89, 0.3))',
            borderRadius: 24,
            padding: '48px 36px',
            maxWidth: 520,
            width: '100%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <Compass
            size={64}
            color="var(--color-gold-bright, #e6c278)"
            style={{ animation: 'spin 12s linear infinite' }}
          />

          <h1
            style={{
              fontFamily: 'var(--font-family-serif, serif)',
              fontSize: '3rem',
              fontWeight: 800,
              color: 'var(--color-gold-bright, #e6c278)',
              margin: 0,
            }}
          >
            404
          </h1>

          <h2 style={{ fontSize: '1.2rem', color: '#ffffff', margin: 0 }}>迷失在位面迷雾中</h2>

          <p
            style={{
              fontSize: '0.9rem',
              color: 'var(--color-text-secondary, #9aa0b8)',
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            您请求的位面节点页面不存在或已被地下城主移除。
          </p>

          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                borderRadius: 10,
                background: 'linear-gradient(135deg, rgba(197,160,89,0.8), rgba(140,110,48,0.9))',
                color: '#000000',
                fontWeight: 600,
                fontSize: '0.9rem',
                textDecoration: 'none',
              }}
            >
              <Home size={16} />
              返回角色大厅
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
