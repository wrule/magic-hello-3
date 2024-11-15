import { join } from 'path';
import dayjs from 'dayjs';
import { createCanvas, GlobalFonts, SKRSContext2D } from '@napi-rs/canvas';

function screenDrawing(ctx: SKRSContext2D, visits: number) {
  ctx.fillStyle = '#020314';
  ctx.fillRect(0, 0, 200, 120);

  ctx.shadowColor = '#39FF14';
  ctx.shadowBlur = 3;
  ctx.fillStyle = '#39FF14';
  ctx.font = '12px monospace';

  ctx.beginPath();
  ctx.strokeStyle = '#39FF14';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.moveTo(0, 15);
  ctx.lineTo(200, 15);
  ctx.stroke();

  ctx.beginPath();
  ctx.setLineDash([3, 3]);
  ctx.moveTo(0, 105);
  ctx.lineTo(200, 105);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(dayjs().format('MM-DD HH:mm:ss'), 3, 2);

  ctx.textAlign = 'right';
  ctx.fillText(`visits: ${visits}`, 197, 2);

  // 在屏幕中心添加 "Me"
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Me', 100, 60);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('>', 3, 120);
  ctx.fillText('power by 36000.eth' + (Math.floor(Date.now() / 1000) % 2 ? '' : '_'), 15, 119);
}

export
const GET = async () => {
  const canvas = createCanvas(200, 120);
  const ctx = canvas.getContext('2d');

  screenDrawing(ctx, 3);

  const buffer = await canvas.encode('png');
  return new Response(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': buffer.length.toString()
    },
  });
};
