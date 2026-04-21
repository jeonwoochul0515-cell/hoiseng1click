import { useEffect, useRef, useState } from 'react';

interface TypewriterFieldProps {
  text: string;
  speed?: number;
  startDelay?: number;
  showCursor?: boolean;
  className?: string;
  onComplete?: () => void;
  onCharTyped?: (charsTyped: number) => void;
}

/**
 * 글자별 타이핑 효과.
 * - speed: 글자당 ms (기본 35). 공백·줄바꿈은 더 짧게.
 * - showCursor: 타이핑 중 blink 커서 표시
 * - text가 바뀌면 처음부터 다시
 */
export default function TypewriterField({
  text,
  speed = 35,
  startDelay = 0,
  showCursor = true,
  className,
  onComplete,
  onCharTyped,
}: TypewriterFieldProps) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const timerRef = useRef<number | null>(null);
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    indexRef.current = 0;

    const tick = () => {
      const i = indexRef.current;
      if (i >= text.length) {
        setDone(true);
        onComplete?.();
        return;
      }
      const ch = text[i];
      indexRef.current = i + 1;
      setDisplayed(text.slice(0, i + 1));
      onCharTyped?.(i + 1);
      const delay = /\s/.test(ch) ? Math.max(8, speed / 3) : speed;
      timerRef.current = window.setTimeout(tick, delay);
    };

    const startTimer = window.setTimeout(tick, startDelay);

    return () => {
      window.clearTimeout(startTimer);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [text, speed, startDelay, onComplete, onCharTyped]);

  return (
    <span className={className}>
      {displayed}
      {showCursor && !done && (
        <span
          aria-hidden
          className="inline-block w-[2px] h-[1em] -mb-[2px] ml-[1px] bg-current animate-[blink_0.9s_steps(1)_infinite]"
        />
      )}
    </span>
  );
}
