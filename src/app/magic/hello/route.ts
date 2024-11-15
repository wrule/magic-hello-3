import { createCanvas } from '@napi-rs/canvas';

export
const GET = async () => {
  const canvas = createCanvas(120, 40);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#00ffff';
  ctx.fillRect(0, 0, 20, 20);
  const buffer = await canvas.encode('png');
  return new Response(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': buffer.length.toString()
    },
  });
};
