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

  // 0.6초 후 화면 중앙 살짝 하단 — 큰 별 + 네온 컬러 폭발
  setTimeout(() => {
    confetti({
      particleCount: 60,
      spread: 80,
      startVelocity: 22,
      origin: { x: 0.5, y: 0.62 },
      shapes: ['star'],
      colors: ['#FF00FF', '#00FFFF', '#39FF14', '#FF073A', '#FFD700'],
      scalar: 1.8,
      ticks: 120,
      gravity: 0.7,
      zIndex: 9999,
    });
  }, 600);

  // 0.85초 후 중앙 하단 — 하트 느낌의 둥근 알갱이 폭포
  setTimeout(() => {
    confetti({
      particleCount: 80,
      spread: 55,
      startVelocity: 18,
      origin: { x: 0.5, y: 0.65 },
      shapes: ['circle'],
      colors: ['#FF69B4', '#FF1493', '#FF6347', '#FF4500', '#FFB6C1'],
      scalar: 1.0,
      ticks: 140,
      gravity: 1.1,
      drift: 0.1,
      zIndex: 9999,
    });
  }, 850);

  // 1.1초 후 중앙 하단 — 사각형 색종이 좌우로 퍼짐
  setTimeout(() => {
    [-0.12, 0.12].forEach((drift) => {
      confetti({
        particleCount: 35,
        spread: 40,
        startVelocity: 26,
        origin: { x: 0.5, y: 0.6 },
        shapes: ['square'],
        colors: ['#3B5BDB', '#7C3AED', '#10B981', '#F59E0B'],
        scalar: 1.1,
        ticks: 110,
        gravity: 0.9,
        drift,
        zIndex: 9999,
      });
    });
  }, 1100);
}
