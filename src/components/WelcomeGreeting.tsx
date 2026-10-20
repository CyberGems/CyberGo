import { useEffect, useState, type CSSProperties } from 'react';
import { Coffee, MoonStar, Sun } from 'lucide-react';
import type { Copy } from '../i18n';
import type { Lang } from '@shared/types';

function getDateTimeParts(lang: Lang, now: Date): { time: string; date: string } {
  const locale = lang === 'es' ? 'es-ES' : 'en-US';
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(now);
  const date = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(now);
  return { time, date };
}

/**
 * The greeting of the lock screen: the moment of the day, the hour and the
 * date. It refreshes when the minute changes.
 */
export default function WelcomeGreeting({
  copy,
  lang,
  className,
  style,
}: {
  copy: Copy;
  lang: Lang;
  className?: string;
  style?: CSSProperties;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const msToNextMinute = 60_000 - (Date.now() % 60_000) + 500;
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, msToNextMinute);
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  const { time, date } = getDateTimeParts(lang, now);
  const hour = now.getHours();
  const TimeIcon = hour < 12 ? Coffee : hour < 19 ? Sun : MoonStar;
  const ariaLabel = `${copy.welcomeBack}, ${time}, ${date}`;

  return (
    <div
      className={`login-greeting${className ? ` ${className}` : ''}`}
      style={style}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <TimeIcon size={13} strokeWidth={1.8} className="login-greeting-icon" aria-hidden="true" />
      <span className="login-greeting-text">{copy.welcomeBack}</span>
      <span className="login-greeting-datetime" aria-hidden="true">
        <span className="login-greeting-sep">·</span>
        <span>{time}</span>
        <span className="login-greeting-sep">·</span>
        <span style={{ textTransform: 'capitalize' }}>{date}</span>
      </span>
    </div>
  );
}
