import dayjs from 'dayjs';
import { createCanvas, SKRSContext2D } from '@napi-rs/canvas';

function screenDrawing(ctx: SKRSContext2D, visits: number) {
  ctx.fillStyle = '#020314';
  ctx.fillRect(0, 0, 200, 120);

  ctx.shadowColor = '#39FF14';
  ctx.shadowBlur = 3;
  ctx.fillStyle = '#39FF14';
  ctx.font = '12px';

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

  ctx.font = '10px';
  const visWidth = ctx.measureText('vis').width;
  const maxX = 201 - visWidth;
  const minX = 0;
  const minY = 20;
  const maxY = 100;

  for (let i = 0; i < Math.min(visits, 320); i++) {
    const x = minX + Math.random() * (maxX - minX);
    const y = minY + Math.random() * (maxY - minY);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('vis', x, y);
  }

  ctx.font = '14px';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const meText = 'Me';
  const meMetrics = ctx.measureText(meText);
  const centerX = 100;
  const centerY = 60;

  ctx.fillStyle = '#020314';
  ctx.fillRect(
    centerX - meMetrics.width/2 - 2,
    centerY - 7,
    meMetrics.width + 4,
    14,
  );

  ctx.fillStyle = '#39FF14';
  ctx.fillText(meText, centerX, centerY);

  ctx.font = '12px';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('>', 3, 120);
  ctx.fillText('power by 36000.eth' + (Math.floor(Date.now() / 1000) % 2 ? '' : '_'), 15, 119);
}

export
const GET = async () => {
  const canvas = createCanvas(200, 120);
  const ctx = canvas.getContext('2d');

  screenDrawing(ctx, 1000);

  const buffer = await canvas.encode('png');
  return new Response(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': buffer.length.toString()
    },
  });
};
