import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import styles from './ChatInput.module.css';

interface Props {
  onSend: (text: string) => void;
  onStop: () => void;
  onClear: () => void;
  disabled: boolean;
}

const PRESETS = [
  '用终端命令查看当前系统时间和操作系统信息',
  '在沙箱里创建一个 hello.txt 文件，内容写"Hello EdgeOne!"，然后读取验证',
  '用 Python 计算斐波那契数列前 20 项并输出',
  '用浏览器抓取 https://edgeone.ai 的页面标题',
];

export default function ChatInput({ onSend, onStop, onClear, disabled }: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  const handlePreset = (text: string) => {
    if (disabled) return;
    onSend(text);
  };

  return (
    <div className={styles.bar}>
      <div className={styles.presets}>
        {PRESETS.map(text => (
          <button
            key={text}
            className={styles.presetChip}
            onClick={() => handlePreset(text)}
            disabled={disabled}
          >
            {text}
          </button>
        ))}
      </div>

      <div className={`${styles.inputWrap} ${disabled ? styles.inputDisabled : ''}`}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder="发消息…  ⏎ 发送 · Shift+⏎ 换行"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          rows={1}
          disabled={disabled}
        />
        <button
          className={`${styles.sendBtn} ${(!value.trim() || disabled) ? styles.sendDisabled : ''}`}
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          aria-label="发送"
        >
          <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
            <path d="M3 10L17 3l-4 7 4 7L3 10z" fill="currentColor"/>
          </svg>
        </button>
        <button
          className={styles.clearBtn}
          onClick={onClear}
          disabled={disabled}
          aria-label="清空历史"
          title="清空历史"
        >
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/>
            <path d="M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
        {disabled && (
          <button
            className={styles.stopBtn}
            onClick={onStop}
            aria-label="停止生成"
            title="停止生成"
          >
            <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
              <rect x="4" y="4" width="12" height="12" rx="2" fill="currentColor"/>
            </svg>
          </button>
        )}
      </div>
      <p className={styles.hint}>由 Python + httpx 驱动 · 仅供演示</p>
    </div>
  );
}
