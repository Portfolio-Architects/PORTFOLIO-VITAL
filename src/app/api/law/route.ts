import { NextResponse } from 'next/server';

const LAW_API_KEY = process.env.LAW_API_KEY || '';

function extractTag(xmlBlock: string, tagName: string): string {
  const match = xmlBlock.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  if (!match) return '';
  let val = match[1].trim();
  const cdataMatch = val.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdataMatch) {
    val = cdataMatch[1].trim();
  }
  return val
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

function parseXmlItem(xmlBlock: string) {
  const idTags = ['법령일련번호', '행정규칙일련번호', '자치법규일련번호', 'admrulId', 'ordinSeq', '자치법규ID', 'ID'];
  const nameTags = ['법령명한글', '행정규칙명', '자치법규명', 'admrulNm', 'ordinNm', '자치법규명한글'];
  const dateTags = ['시행일자', 'prmlDt', '공포일자', '발령일자', '제정개정일자'];
  const agencyTags = ['소관부처명', '소관부처', '지자체명', '지자체기관명', '소관지자체명', 'ocmpDeptNm', 'orgNm'];
  const linkTags = ['link', '법령상세링크', '자치법규상세링크', '행정규칙상세링크'];
  
  let id = '';
  for (const tag of idTags) {
    id = extractTag(xmlBlock, tag);
    if (id) break;
  }
  
  let title = '';
  for (const tag of nameTags) {
    title = extractTag(xmlBlock, tag);
    if (title) break;
  }
  
  let date = '';
  for (const tag of dateTags) {
    date = extractTag(xmlBlock, tag);
    if (date) break;
  }
  
  let agency = '';
  for (const tag of agencyTags) {
    agency = extractTag(xmlBlock, tag);
    if (agency) break;
  }
  
  let link = '';
  for (const tag of linkTags) {
    link = extractTag(xmlBlock, tag);
    if (link) break;
  }
  if (link.startsWith('/')) {
    link = `https://www.law.go.kr${link}`;
  }
  
  return { id, title, date, agency, link };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mst = searchParams.get('mst') || '';
    const query = searchParams.get('query') || '';
    const target = searchParams.get('target') || 'law'; // law, admrul, ordin
    const page = searchParams.get('page') || '1';
    const type = searchParams.get('type') || 'HTML'; // HTML or XML for body

    if (!LAW_API_KEY) {
      return NextResponse.json({ error: 'LAW_API_KEY is not configured in .env.local' }, { status: 500 });
    }

    // 1. Body Search (본문 조회)
    if (mst) {
      const idParam = target === 'admrul' ? `ID=${mst}` : `MST=${mst}`;
      const url = `http://www.law.go.kr/DRF/lawService.do?OC=${LAW_API_KEY}&target=${target}&type=${type}&${idParam}`;
      
      console.log(`[Law API Route] Direct request for body: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'Accept': type === 'HTML' ? 'text/html' : 'application/xml',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch law body. Status: ${response.status}`);
      }

      const text = await response.text();

      // Check if body response is actually an XML error (e.g. user validation failed)
      if (text.includes('<result>') && text.includes('<msg>')) {
        const result = extractTag(text, 'result');
        const msg = extractTag(text, 'msg');
        return NextResponse.json({ success: false, error: `${result} - ${msg}` }, { status: 400 });
      }

      return new NextResponse(text, {
        headers: {
          'Content-Type': type === 'HTML' ? 'text/html; charset=utf-8' : 'application/xml; charset=utf-8',
        }
      });
    }

    // 2. List Search (목록 조회)
    if (!query) {
      return NextResponse.json({ totalCnt: 0, items: [] });
    }

    const url = `http://www.law.go.kr/DRF/lawSearch.do?OC=${LAW_API_KEY}&target=${target}&type=XML&query=${encodeURIComponent(query)}&page=${page}&display=50`;

    console.log(`[Law API Route] Direct request for list: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/xml',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch law list. Status: ${response.status}`);
    }

    const xmlText = await response.text();

    // Check if direct response is an XML error (e.g. user validation failed due to unregistered IP)
    if (xmlText.includes('<result>') && xmlText.includes('<msg>')) {
      const result = extractTag(xmlText, 'result');
      const msg = extractTag(xmlText, 'msg');
      return NextResponse.json({ success: false, error: `${result} - ${msg}` }, { status: 400 });
    }
    
    // Parse totalCnt
    const totalCntMatch = xmlText.match(/<totalCnt>([^<]*)<\/totalCnt>/i);
    const totalCnt = totalCntMatch ? parseInt(totalCntMatch[1].trim(), 10) : 0;

    // Parse items (every <law id="...">, <admrul id="...">, or <ordin id="..."> block)
    const items: any[] = [];
    const lawBlockRegex = /<(law|admrul|ordin)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g;
    let match;
    
    while ((match = lawBlockRegex.exec(xmlText)) !== null) {
      const itemXml = match[2];
      const parsedItem = parseXmlItem(itemXml);
      if (parsedItem.title) {
        items.push(parsedItem);
      }
    }

    return NextResponse.json({
      success: true,
      totalCnt,
      page: parseInt(page, 10),
      items
    });

  } catch (err: any) {
    console.error('[Law API Route] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Unknown error' }, { status: 500 });
  }
}
