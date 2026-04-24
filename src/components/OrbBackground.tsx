'use client';

interface OrbBackgroundProps {
  variant: 'white' | 'black';
}

const orbsOnWhite = [
  { color: 'bg-purple-400', size: 350, top: '5%', left: '10%', anim: 'animate-orb1' },
  { color: 'bg-blue-400', size: 300, top: '50%', left: '60%', anim: 'animate-orb2' },
  { color: 'bg-pink-400', size: 280, top: '70%', left: '20%', anim: 'animate-orb3' },
  { color: 'bg-yellow-300', size: 200, top: '20%', left: '75%', anim: 'animate-orb4' },
  { color: 'bg-green-400', size: 250, top: '80%', left: '70%', anim: 'animate-orb5' },
  { color: 'bg-orange-400', size: 220, top: '40%', left: '35%', anim: 'animate-orb6' },
];

const orbsOnBlack = [
  { color: 'bg-purple-500', size: 350, top: '5%', left: '10%', anim: 'animate-orb1' },
  { color: 'bg-blue-500', size: 300, top: '50%', left: '60%', anim: 'animate-orb2' },
  { color: 'bg-pink-500', size: 280, top: '70%', left: '20%', anim: 'animate-orb3' },
  { color: 'bg-cyan-400', size: 200, top: '20%', left: '75%', anim: 'animate-orb4' },
  { color: 'bg-green-400', size: 250, top: '80%', left: '70%', anim: 'animate-orb5' },
  { color: 'bg-amber-400', size: 220, top: '40%', left: '35%', anim: 'animate-orb6' },
];

export default function OrbBackground({ variant }: OrbBackgroundProps) {
  const orbs = variant === 'white' ? orbsOnWhite : orbsOnBlack;
  const blendClass = variant === 'white' ? 'orb-multiply' : 'orb-screen';

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {orbs.map((orb, i) => (
        <div
          key={i}
          className={`orb ${orb.color} ${blendClass} ${orb.anim}`}
          style={{
            width: orb.size,
            height: orb.size,
            top: orb.top,
            left: orb.left,
          }}
        />
      ))}
    </div>
  );
}
