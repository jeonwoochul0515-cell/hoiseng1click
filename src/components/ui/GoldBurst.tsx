import { useEffect, useState } from 'react';
import { useUiStore } from '@/store/uiStore';

interface GoldBurstProps {
  message?: string;
  onComplete?: () => void;
}

const PARTICLE_COUNT = 10;

function generateParticles() {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const angle = (360 / PARTICLE_COUNT) * i;
    const rad = (angle * Math.PI) / 180;
    const dist = 60 + Math.random() * 40;
    const tx = Math.cos(rad) * dist;
    const ty = Math.sin(rad) * dist;
    const size = 6 + Math.random() * 6;
    const delay = Math.random() * 200;
    return { tx, ty, size, delay, id: i };
  });
}

export default function GoldBurst({ message, onComplete }: GoldBurstProps) {
  const { goldBurst, hideGoldBurst } = useUiStore();
  const [fadeOut, setFadeOut] = useState(false);
  const [particles] = useState(generateParticles);

  const displayMessage = message ?? goldBurst.message;

  useEffect(() => {
    if (!goldBurst.show) return;

    setFadeOut(false);

    const fadeTimer = setTimeout(() => setFadeOut(true), 2500);
    const hideTimer = setTimeout(() => {
      hideGoldBurst();
      onComplete?.();
    }, 3000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [goldBurst.show, hideGoldBurst, onComplete]);

  if (!goldBurst.show) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="relative flex flex-col items-center">
        {/* Gold checkmark */}
        <div
          className="flex items-center justify-center w-20 h-20 rounded-full bg-brand-gold/20"
          style={{ animation: 'gold-check-bounce 0.4s ease-out forwards' }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 25L20 33L36 15"
              stroke="#C9A84C"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Particles */}
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute left-1/2 top-1/2 rounded-full bg-brand-gold"
            style={{
              width: p.size,
              height: p.size,
              marginLeft: -p.size / 2,
              marginTop: -p.size / 2,
              '--tx': `${p.tx}px`,
              '--ty': `${p.ty}px`,
              animation: `gold-particle 0.7s ${p.delay}ms ease-out forwards`,
            } as React.CSSProperties}
          />
        ))}

        {/* Message */}
        <p
          className="mt-6 text-lg font-semibold text-white"
          style={{ animation: 'fade-up 0.3s 0.2s ease-out both' }}
        >
          {displayMessage}
        </p>
      </div>
    </div>
  );
}
