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

  // 0.75초 후 중앙 하단 — 핑크 원형 + 블루·퍼플 사각 동시에 (넓게)
  setTimeout(() => {
    confetti({
      particleCount: 40,
      spread: 140,
      startVelocity: 28,
      origin: { x: 0.5, y: 0.78 },
      shapes: ['circle'],
      colors: ['rgba(255,105,180,0.55)', 'rgba(255,20,147,0.55)', 'rgba(255,99,71,0.55)', 'rgba(255,69,0,0.55)', 'rgba(255,182,193,0.55)'],
      scalar: 1.0,
      ticks: 140,
      gravity: 0.8,
      zIndex: 9999,
    });

    [-0.2, 0.2].forEach((drift) => {
      confetti({
        particleCount: 18,
        spread: 120,
        startVelocity: 32,
        origin: { x: 0.5, y: 0.78 },
        shapes: ['square'],
        colors: ['rgba(59,91,219,0.55)', 'rgba(124,58,237,0.55)', 'rgba(16,185,129,0.55)', 'rgba(245,158,11,0.55)'],
        scalar: 1.1,
        ticks: 120,
        gravity: 0.75,
        drift,
        zIndex: 9999,
      });
    });
  }, 750);
}
