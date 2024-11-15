import dayjs from 'dayjs';
import { headers } from 'next/headers';
import { createCanvas, SKRSContext2D } from '@napi-rs/canvas';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { NextRequest } from 'next/server';


interface IPInfo {
  ip: string;                    // 最可能的真实IP
  alternativeIPs: string[];      // 其他可能的IP
  source: string;                // IP来源
  confidence: number;            // 可信度（0-100）
  debug: {                       // 调试信息
    headers: Record<string, string | null>;
    environment: string;         // 检测到的环境
    ipChain: string[];          // 完整IP链路
  };
}

function getClientIP(headers: Headers): IPInfo {
  // 基础配置
  const config = {
    privateIPRanges: [
      /^0\./, /^127\./, /^10\./, 
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, 
      /^192\.168\./, /^169\.254\./,
      /^fc00:/,      // IPv6 unique local addr
      /^fe80:/       // IPv6 link-local addr
    ],
    ipv4Regex: /^(\d{1,3}\.){3}\d{1,3}$/,
    ipv6Regex: /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$|^([0-9a-fA-F]{1,4}:){0,7}:|^:[0-9a-fA-F]{1,4}(:[0-9a-fA-F]{1,4}){0,6}$/
  };

  // 收集所有header信息用于调试
  const debugHeaders: Record<string, string | null> = {};
  headers.forEach((value, key) => {
    debugHeaders[key.toLowerCase()] = value;
  });

  // 检测运行环境
  const detectEnvironment = (): string => {
    const env: string[] = [];
    if (headers.get('cf-ray')) env.push('Cloudflare');
    if (headers.get('x-amzn-trace-id')) env.push('AWS');
    if (headers.get('x-vercel-id')) env.push('Vercel');
    if (headers.get('x-forwarded-host')?.includes('amplifyapp')) env.push('Amplify');
    return env.length ? env.join('+') : 'Unknown';
  };

  // IP地址验证
  const validateIP = (ip: string): boolean => {
    if (!ip || typeof ip !== 'string') return false;
    
    // 清理IP地址
    ip = ip.trim();
    // 移除端口号
    ip = ip.split(':')[0];
    // 移除IPv6括号
    ip = ip.replace(/[\[\]]/g, '');

    // 验证格式
    const isValidFormat = config.ipv4Regex.test(ip) || config.ipv6Regex.test(ip);
    if (!isValidFormat) return false;

    // 检查是否是私有IP
    const isPrivate = config.privateIPRanges.some(range => range.test(ip));
    return !isPrivate;
  };

  // 提取并验证IP地址
  const extractIPs = (value: string): string[] => {
    if (!value) return [];

    // 处理JSON格式（API Gateway）
    if (value.startsWith('{')) {
      try {
        const parsed = JSON.parse(value);
        if (parsed.requestContext?.identity?.sourceIp) {
          return [parsed.requestContext.identity.sourceIp];
        }
      } catch {
        // JSON解析失败，继续处理其他格式
      }
    }

    // 分割IP列表
    const ips = value.split(/[,\s]+/)
      .map(ip => ip.trim())
      .map(ip => {
        // 处理forwarded格式
        const forMatch = ip.match(/for=([^;,\s]+)/);
        return forMatch ? forMatch[1].replace(/[\[\]"]/g, '') : ip;
      })
      .filter(ip => validateIP(ip));

    return [...new Set(ips)]; // 去重
  };

  // 按优先级排序的IP来源
  const ipSources = [
    // Cloudflare
    { header: 'cf-connecting-ip', priority: 100 },
    { header: 'true-client-ip', priority: 95 },
    
    // AWS
    { header: 'cloudfront-viewer-address', priority: 90 },
    { header: 'x-apigateway-event', priority: 85 },
    
    // 通用代理头
    { header: 'x-forwarded-for', priority: 80 },
    { header: 'x-real-ip', priority: 75 },
    { header: 'x-client-ip', priority: 70 },
    { header: 'forwarded', priority: 65 },
    
    // 后备选项
    { header: 'remote-addr', priority: 60 }
  ];

  // 收集所有可能的IP
  let allIPs: Array<{ ip: string; priority: number; source: string }> = [];
  const ipChain: string[] = [];

  ipSources.forEach(({ header, priority }) => {
    const value = headers.get(header);
    if (value) {
      const extractedIPs = extractIPs(value);
      extractedIPs.forEach(ip => {
        allIPs.push({ ip, priority, source: header });
        if (!ipChain.includes(ip)) {
          ipChain.push(ip);
        }
      });
    }
  });

  // 根据优先级排序
  allIPs.sort((a, b) => b.priority - a.priority);

  // 如果没有找到任何有效IP
  if (allIPs.length === 0) {
    return {
      ip: '0.0.0.0',
      alternativeIPs: [],
      source: 'none',
      confidence: 0,
      debug: {
        headers: debugHeaders,
        environment: detectEnvironment(),
        ipChain: []
      }
    };
  }

  // 计算可信度
  const calculateConfidence = (source: string, environment: string): number => {
    let confidence = 70; // 基础可信度

    // 根据来源调整可信度
    if (source === 'cf-connecting-ip' && environment.includes('Cloudflare')) {
      confidence = 100;
    } else if (source === 'cloudfront-viewer-address' && environment.includes('AWS')) {
      confidence = 95;
    } else if (source === 'x-forwarded-for') {
      confidence = environment.includes('AWS') ? 90 : 80;
    }

    return confidence;
  };

  // 构建返回结果
  const primaryIP = allIPs[0];
  const environment = detectEnvironment();
  
  return {
    ip: primaryIP.ip,
    alternativeIPs: [...new Set(allIPs.slice(1).map(item => item.ip))],
    source: primaryIP.source,
    confidence: calculateConfidence(primaryIP.source, environment),
    debug: {
      headers: debugHeaders,
      environment,
      ipChain
    }
  };
}



const client = new DynamoDBClient({ region: 'ap-northeast-1' });
const docClient = DynamoDBDocumentClient.from(client);

export const dynamic = 'force-dynamic';

let count = 0;

function screenDrawing(ctx: SKRSContext2D, visits: number) {
  const now = Date.now();
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
  ctx.fillText(dayjs(now).format('MM-DD HH:mm:ss'), 3, 2);

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

  ctx.fillStyle = 'red';
  ctx.fillRect(
    centerX - meMetrics.width/2 - 2,
    centerY - 7,
    meMetrics.width + 4,
    14,
  );

  ctx.fillStyle = 'white';
  ctx.fillText(meText, centerX, centerY);

  ctx.fillStyle = '#39FF14';

  ctx.font = '12px';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('>', 3, 120);
  ctx.fillText('power by 36000.eth' + (Math.floor(now / 1000) % 2 ? '' : '_'), 15, 119);
}

export
const GET = async (
  request: NextRequest,
  { params }: { params: { id: string } },
) => {

  const headersList = headers();
  const clientInfo = getClientIP(headersList);

  const key = `${clientInfo.ip}-${params.id}`;

  (async () => {
    try {
      const updateResponse = await docClient.send(new UpdateCommand({
        TableName: 'visitor',
        Key: {
          pKey: key,
          sortKey: key
        },
        UpdateExpression: 'SET #count = if_not_exists(#count, :zero) + :one, #time = :time, #info = :info',
        ExpressionAttributeNames: {
          '#count': 'count',
          '#time': 'time',
          '#info': 'clientInfo'
        },
        ExpressionAttributeValues: {
          ':zero': 0,
          ':one': 1,
          ':time': dayjs().format('YYYY-MM-DD HH:mm:ss'),
          ':info': clientInfo
        },
        ReturnValues: 'ALL_NEW'
      }));
      console.log('Updated:', updateResponse.Attributes);
    } catch (error) {
      console.error('Error:', error);
    }

    // try {
    //   const queryResponse = await docClient.send(new QueryCommand({
    //     TableName: 'visitor',
    //     KeyConditionExpression: 'begins_with(pKey, :prefix)',
    //     ExpressionAttributeValues: {
    //       ':prefix': 'abc'
    //     },
    //     Select: 'COUNT'  // 只返回计数，而不是完整记录
    //   }));
      
    //   console.log('匹配记录数量:', queryResponse.Count);
    //   // 如果需要完整的扫描信息
    //   console.log('扫描的记录数量:', queryResponse.ScannedCount);
      
    // } catch (error) {
    //   console.error('Error:', error);
    // }

  })();

  const canvas = createCanvas(200, 120);
  const ctx = canvas.getContext('2d');

  count++;

  screenDrawing(ctx, count);

  const buffer = await canvas.encode('png');
  return new Response(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
};
