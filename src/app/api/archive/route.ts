import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { ArchiveItem, ArchiveSearchResponse } from '@/types/archive';

const INDEX_FILE_PATH = path.join(process.cwd(), 'data', 'ARCHIVE_INDEX.json');

interface CachedIndex {
  mtimeMs: number;
  data: {
    generatedAt: string;
    archiveRoot: string;
    totalIndexed: number;
    facets: {
      years: Record<string, number>;
      projects: Record<string, number>;
      categories: Record<string, number>;
    };
    items: ArchiveItem[];
  };
}

let cachedIndex: CachedIndex | null = null;

// 보건소 건강증진·신체활동 실무 도메인 추론·동의어 확장 사전
const SYNONYM_GROUPS: string[][] = [
  ['양재천', '페스티벌', '걷기대회', '건강축제', '수변문화쉼터', '제이민', '스티커투어'],
  ['서울체력장', '체력장', '체력인증센터', '메디헬스', '메디런', '헬스체크업', '강남센터', '트레이닝센터'],
  ['아이뛰움', '아이_뛰움', '어린이신체활동', '1학기', '2학기', '바른자세', '척추측만증', '체형교정'],
  ['손목닥터', '손목닥터9988', '9988', '스마트헬스', '커뮤니티'],
  ['비만예방', '비만', '건강뜀', '합동캠페인', '중강도걷기', '당류저감', '일당오십'],
  ['행감', '행정사무감사', '감사자료', '요구자료', '별첨'],
  ['예산', '본예산', '가내시', '사업설명서', '편성총괄표', '산출내역', '세출예산', '이호조', 'e-호조'],
  ['계약', '수의계약', '견적서', '타견적서', '준공계', '납품검사원', '물품검사조서', '입금계좌', '지급조서'],
  ['포스터', '현수막', '배너', '시안', '리플릿', '리플렛', '브로슈어', '카드뉴스', '키비주얼'],
  ['주요업무', '주간업무', '정례회', '업무보고', '성과관리', '성과계획서', '공약사업', '민선9기'],
  ['보안', '유해사이트', 'vpn', '개인정보', '생성형ai', '보안서약서'],
];

function expandQuerySynonyms(tokens: string[]): Set<string> {
  const expanded = new Set<string>();
  for (const token of tokens) {
    const lower = token.toLowerCase();
    for (const group of SYNONYM_GROUPS) {
      if (group.some((w) => w.toLowerCase().includes(lower) || lower.includes(w.toLowerCase()))) {
        for (const w of group) {
          expanded.add(w.toLowerCase());
        }
      }
    }
  }
  return expanded;
}

function loadArchiveIndex(): CachedIndex['data'] {
  if (!fs.existsSync(INDEX_FILE_PATH)) {
    return {
      generatedAt: new Date().toISOString(),
      archiveRoot: 'F:\\_Organized_Archive',
      totalIndexed: 0,
      facets: { years: {}, projects: {}, categories: {} },
      items: [],
    };
  }
  const stat = fs.statSync(INDEX_FILE_PATH);
  if (cachedIndex && cachedIndex.mtimeMs === stat.mtimeMs) {
    return cachedIndex.data;
  }
  const raw = fs.readFileSync(INDEX_FILE_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  cachedIndex = { mtimeMs: stat.mtimeMs, data: parsed };
  return parsed;
}

function buildClusterForItem(anchor: ArchiveItem, allItems: ArchiveItem[]) {
  const anchorKeywords = new Set(anchor.keywords.map((k) => k.toLowerCase()));
  const anchorTime = new Date(anchor.date).getTime() || 0;

  const scoredRelated: { item: ArchiveItem; relScore: number }[] = [];

  for (const cand of allItems) {
    if (cand.id === anchor.id) continue;

    let relScore = 0;
    if (cand.project === anchor.project && cand.year === anchor.year) {
      relScore += 40;
    } else if (cand.project === anchor.project) {
      relScore += 20;
    }

    if (cand.subFolder && cand.subFolder === anchor.subFolder && cand.year === anchor.year) {
      relScore += 35;
    }

    // Shared keywords
    let sharedKw = 0;
    for (const kw of cand.keywords) {
      if (anchorKeywords.has(kw.toLowerCase())) {
        sharedKw++;
      }
    }
    relScore += sharedKw * 12;

    // Date proximity (within 14 days)
    if (anchorTime > 0) {
      const candTime = new Date(cand.date).getTime() || 0;
      const diffDays = Math.abs(anchorTime - candTime) / (1000 * 60 * 60 * 24);
      if (diffDays <= 3) relScore += 20;
      else if (diffDays <= 14) relScore += 10;
    }

    if (relScore >= 35) {
      scoredRelated.push({ item: cand, relScore });
    }
  }

  scoredRelated.sort((a, b) => b.relScore - a.relScore || b.item.mtime - a.item.mtime);

  const docs: ArchiveItem[] = [];
  const sheets: ArchiveItem[] = [];
  const images: ArchiveItem[] = [];

  for (const { item } of scoredRelated) {
    if ((item.category === 'doc' || item.category === 'slide') && docs.length < 8) {
      docs.push(item);
    } else if (item.category === 'sheet' && sheets.length < 6) {
      sheets.push(item);
    } else if (item.category === 'image' && images.length < 12) {
      images.push(item);
    }
    if (docs.length >= 8 && sheets.length >= 6 && images.length >= 12) {
      break;
    }
  }

  return { anchor, docs, sheets, images };
}

export async function GET(request: NextRequest) {
  try {
    const indexData = loadArchiveIndex();
    const { searchParams } = new URL(request.url);

    const q = (searchParams.get('q') || '').trim();
    const year = searchParams.get('year') || 'ALL';
    const project = searchParams.get('project') || 'ALL';
    const category = searchParams.get('category') || 'ALL';
    const imageCategory = searchParams.get('imageCategory') || 'ALL';
    const clusterFor = searchParams.get('clusterFor') || '';
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '120', 10), 10), 500);

    // 1. Filter by facet criteria
    let filtered = indexData.items.filter((item) => {
      if (year !== 'ALL' && item.year !== year) return false;
      if (project !== 'ALL' && item.project !== project) return false;
      if (category !== 'ALL' && item.category !== category) return false;
      if (imageCategory !== 'ALL' && item.imageCategory !== imageCategory) return false;
      return true;
    });

    // 2. Full-text + Synonym + Context Scoring if query present
    if (q.length > 0) {
      const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
      const synonyms = expandQuerySynonyms(tokens);

      const scored: ArchiveItem[] = [];

      for (const item of filtered) {
        const nameLower = item.name.toLowerCase();
        const pathLower = `${item.project} ${item.subFolder}`.toLowerCase();
        const snippetLower = (item.snippet || '').toLowerCase();
        const kwLower = item.keywords.join(' ').toLowerCase();

        let totalScore = 0;
        let primaryReason: ArchiveItem['matchReason'] = 'context';
        let matchedTokens = 0;

        for (const token of tokens) {
          let tokenScore = 0;
          if (nameLower.includes(token)) {
            tokenScore += 100;
            primaryReason = 'filename';
          }
          if (pathLower.includes(token)) {
            tokenScore += 60;
            if (primaryReason !== 'filename') primaryReason = 'context';
          }
          if (snippetLower.includes(token)) {
            tokenScore += 75;
            if (primaryReason !== 'filename') primaryReason = 'content';
          }
          if (kwLower.includes(token)) {
            tokenScore += 50;
            if (primaryReason === 'context' && snippetLower.includes(token)) {
              primaryReason = 'content';
            }
          }
          if (tokenScore > 0) {
            matchedTokens++;
            totalScore += tokenScore;
          }
        }

        // Synonym / Inference match when exact token isn't in filename
        if (matchedTokens < tokens.length && synonyms.size > 0) {
          for (const syn of synonyms) {
            if (nameLower.includes(syn) || snippetLower.includes(syn) || pathLower.includes(syn) || kwLower.includes(syn)) {
              totalScore += 35;
              if (matchedTokens === 0) {
                primaryReason = 'synonym';
              }
              matchedTokens = Math.max(matchedTokens, 1);
            }
          }
        }

        if (totalScore > 0 && matchedTokens > 0) {
          // Boost all-token match and recent 2026 files slightly
          if (matchedTokens === tokens.length) totalScore += 50;
          if (item.year === '2026년') totalScore += 10;

          scored.push({
            ...item,
            score: totalScore,
            matchReason: primaryReason,
          });
        }
      }

      scored.sort((a, b) => (b.score || 0) - (a.score || 0) || b.mtime - a.mtime);
      filtered = scored;
    }

    const totalMatched = filtered.length;
    const sliced = filtered.slice(0, limit);

    // 3. Build linked project cluster for requested item (or top matched item)
    let cluster: ArchiveSearchResponse['cluster'] = null;
    const targetClusterId = clusterFor || (sliced.length > 0 ? sliced[0].id : '');
    if (targetClusterId) {
      const anchor = indexData.items.find((x) => x.id === targetClusterId);
      if (anchor) {
        cluster = buildClusterForItem(anchor, indexData.items);
      }
    }

    const responsePayload: ArchiveSearchResponse = {
      generatedAt: indexData.generatedAt,
      totalIndexed: indexData.totalIndexed,
      totalMatched,
      facets: indexData.facets,
      items: sliced,
      cluster,
    };

    return NextResponse.json(responsePayload);
  } catch (err: any) {
    console.error('[API /api/archive Error]:', err);
    return NextResponse.json(
      { error: 'Failed to query archive index', details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
