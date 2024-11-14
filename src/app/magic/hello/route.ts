import { NextResponse } from 'next/server';

export
const GET = (request: Request) => {
  return NextResponse.json({
    message: '你好，世界',
  });
};
