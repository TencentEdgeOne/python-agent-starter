import type { ToolLampState } from '../types';
import styles from './ToolLamp.module.css';

interface Props {
  lamp: ToolLampState;
}

export default function ToolLamp({ lamp }: Props) {
  return (
    <div className={`${styles.lamp} ${lamp.active ? styles.active : ''}`}>
      {/* key=animKey remounts the span on each activation to replay CSS animation */}
      <span key={lamp.animKey} className={styles.icon}>{lamp.icon}</span>
      <span className={styles.label}>{lamp.label}</span>
    </div>
  );
}
