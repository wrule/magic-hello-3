import { join } from 'path';
import dayjs from 'dayjs';
import { createCanvas, GlobalFonts, SKRSContext2D } from '@napi-rs/canvas';

function screenDrawing(ctx: SKRSContext2D) {
  // 深邃的蓝黑色背景
  ctx.fillStyle = '#020314';
  ctx.fillRect(0, 0, 200, 120);

  // 经典终端绿
  ctx.shadowColor = '#39FF14';
  ctx.shadowBlur = 3;
  ctx.fillStyle = '#39FF14';
  ctx.font = '12px monospace';

  // 顶部实线
  ctx.beginPath();
  ctx.strokeStyle = '#39FF14';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.moveTo(0, 15);  // 从20改为15
  ctx.lineTo(200, 15);
  ctx.stroke();

  // 底部虚线
  ctx.beginPath();
  ctx.setLineDash([3, 3]);
  ctx.moveTo(0, 105);  // 从100改为105
  ctx.lineTo(200, 105);
  ctx.stroke();

  // 左上角时间
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(dayjs().format('MM-DD HH:mm:ss'), 3, 2);  // 从3改为2

  // 右上角访客数
  ctx.textAlign = 'right';
  ctx.fillText(`visits: ${32}`, 197, 2);  // 从3改为2

  // 左下角终端提示符和签名
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('>', 3, 120);  // 从117改为118
  ctx.fillText('power by 36000.eth' + (Math.floor(Date.now() / 1000) % 2 ? '' : '_'), 15, 119);  // 从117改为118
}

export
const GET = async () => {
  const canvas = createCanvas(200, 120);
  const ctx = canvas.getContext('2d');

  screenDrawing(ctx);

  const buffer = await canvas.encode('png');
  return new Response(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': buffer.length.toString()
    },
  });
};
