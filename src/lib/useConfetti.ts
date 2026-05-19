import confetti from 'canvas-confetti';

export function fireConfetti() {
  const count = 180;
  const defaults = { startVelocity: 30, spread: 360, ticks: 80, zIndex: 9999 };

  function random(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  // 화면 세 곳에서 폭발
  const origins = [
    { x: random(0.1, 0.3), y: random(0.3, 0.5) },
    { x: random(0.4, 0.6), y: random(0.1, 0.3) },
    { x: random(0.7, 0.9), y: random(0.3, 0.5) },
  ];

  origins.forEach((origin, i) => {
    setTimeout(() => {
      confetti({
        ...defaults,
        particleCount: Math.floor(count / origins.length),
        origin,
        colors: ['#3B5BDB', '#7C3AED', '#F59E0B', '#EF4444', '#10B981', '#EC4899'],
        shapes: ['circle', 'square'],
        scalar: random(0.8, 1.2),
      });
    }, i * 120);
  });

  // 0.4초 후 별 모양 추가
  setTimeout(() => {
    confetti({
      particleCount: 30,
      spread: 100,
      origin: { x: 0.5, y: 0.4 },
      shapes: ['star'],
      colors: ['#FFD700', '#FFA500', '#FF6347'],
      scalar: 1.4,
      ticks: 100,
      zIndex: 9999,
    });
  }, 400);
}
