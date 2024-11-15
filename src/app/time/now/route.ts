import dayjs from 'dayjs';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export
const GET = async () => {
  return NextResponse.json({
    now: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  });
}
