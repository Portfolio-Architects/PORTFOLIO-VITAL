import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { RAGEngine } from '@/lib/rag/rag-engine';
import { sanitizeAdministrativeText } from '@/lib/administrativeFormatter';

// Initialize Gemini API
const apiKey = process.env.GOOGLE_GEMINI_API_KEY || '';

// Clean reasoning steps (Chain of Thought) from Gemma responses
function cleanGemmaResponse(text: string): string {
  if (!text) return '';
  
  // 1. [Yy]es. 뒤에 즉시 또는 공백 후 시작되는 첫 한글 문자부터 끝까지 추출 (멀티라인 매칭)
  const regex = /[Yy]es\.\s*([가-힣][\s\S]*)$/;
  const match = text.match(regex);
  let rawContent = '';
  
  if (match && match[1]) {
    rawContent = match[1].trim();
  } else {
    // 2. 만약 Yes. 패턴이 매칭되지 않는다면, 영어 생각 단계가 끝나는 경계를 탐색.
    // 영어 생각 단계의 메타데이터 및 지시어가 아닌 실질적인 본문 시작 라인을 찾기 위해 순방향 검사 수행.
    const lines = text.split('\n');
    let bodyStartIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (
        /[가-힣]/.test(trimmed) && 
        !trimmed.startsWith('*') && 
        !trimmed.includes('User query:') &&
        !trimmed.includes('User input:') &&
        !trimmed.includes('Draft:') &&
        !trimmed.includes('Constraint') &&
        !trimmed.includes('Role:') &&
        !trimmed.includes('Node:') &&
        !trimmed.includes('Contact:') &&
        !trimmed.includes('Person in charge:') &&
        !trimmed.includes('Email:')
      ) {
        bodyStartIdx = i;
        break;
      }
    }

    if (bodyStartIdx !== -1) {
      rawContent = lines.slice(bodyStartIdx).join('\n').trim();
    } else {
      rawContent = text.trim();
    }
  }

  // 3. 중복 제거 필터 (Deduplicator):
  // 들여쓰기(공백 2개 이상)로 시작하는 라인은 CoT 또는 Draft 내부 라인으로 간주하여 제거하고,
  // 들여쓰기가 없는 라인(진짜 본문)만 모읍니다.
  const rawLines = rawContent.split('\n');
  const finalLines = rawLines.map(line => {
    if (/^\s{2,}/.test(line)) {
      return null;
    }
    return line;
  }).filter((line): line is string => line !== null);

  // 4. 추가 핫픽스: 한 줄 내에 '010792491511. 담당자: 이상혁 이사님'과 같이 붙어 있는 중복 패턴을 분할 및 고침
  let cleanedContent = finalLines.join('\n').trim();
  cleanedContent = cleanedContent.replace(/(\d+)([1-9]\.\s+[가-힣])/g, '$1\n$2');

  // 5. 중복 라인 자체를 최종 소거 (중복 paragraph 방지)
  const paragraphLines = cleanedContent.split('\n');
  const uniqueLines: string[] = [];
  const seen = new Set<string>();
  for (const line of paragraphLines) {
    const trimmed = line.trim();
    if (trimmed) {
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
    }
    uniqueLines.push(line);
  }

  const rawJoined = uniqueLines.join('\n').trim();
  return sanitizeAdministrativeText(rawJoined);
}

// Format history for Gemini using sliding window compaction (last 6 turns intact + compact summary of older turns)
function compactHistory(messages: any[], maxTurns = 6) {
  const historyMsgs = messages.slice(0, -1).filter((m: any) => m.role === 'user' || m.role === 'assistant');
  if (historyMsgs.length <= maxTurns) {
    return historyMsgs.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content || '' }],
    }));
  }
  const oldTurns = historyMsgs.slice(0, -maxTurns);
  const recentTurns = historyMsgs.slice(-maxTurns);
  const summaryText = `[이전 대화 요약]: ${oldTurns.map((m: any) => `${m.role === 'user' ? 'Q' : 'A'}: ${(m.content || '').slice(0, 60)}`).join(' | ')}`;
  
  return [
    { role: 'user', parts: [{ text: summaryText }] },
    { role: 'model', parts: [{ text: '이전 대화 내용을 숙지했습니다.' }] },
    ...recentTurns.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content || '' }],
    })),
  ];
}

export async function POST(req: Request) {
  try {
    const { messages, contextData, appMode } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array must not be empty' }, { status: 400 });
    }

    const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
    const lastMessage = messages[messages.length - 1];

    // Query keyword pre-filtering for context relevance
    const queryKeywords = (lastMessage?.content || '').toLowerCase().split(/\s+/).filter((w: string) => w.length >= 2);

    // Build signals context (query-filtered, capped at top 20 max)
    const rawSignals = contextData?.signals || [];
    const filteredSignals = rawSignals.filter((s: any) => {
      const text = `${s.type || ''} ${s.category || ''} ${s.text || ''} ${s.content || ''} ${s.title || ''}`.toLowerCase();
      return queryKeywords.some((kw: string) => text.includes(kw));
    });
    const selectedSignals = (filteredSignals.length > 0 ? filteredSignals : rawSignals).slice(0, 20);
    const signalsText = selectedSignals.map((s: any) => `- [${s.type || s.category || '알림'}] ${s.text || s.content || s.title}`).join('\n') || '없음';
    
    // Hybrid RAG Search
    let matchedWikiText = contextData?.matchedWiki || '';
    try {
      const ragResults = await RAGEngine.search(lastMessage?.content || '', 4);
      if (ragResults.length > 0) {
        const ragText = ragResults.map(r => 
          `[노드: ${r.nodeLabel}] RAG 매칭 내용 (유사도: ${r.score.toFixed(2)}):\n${r.chunk}`
        ).join('\n\n');
        
        if (matchedWikiText) {
          matchedWikiText = `--- [클라이언트 매칭 위키] ---\n${matchedWikiText}\n\n--- [하이브리드 RAG 검색 위키] ---\n${ragText}`;
        } else {
          matchedWikiText = ragText;
        }
      }
    } catch (ragErr) {
      console.error('[Chat API] Hybrid RAG Search failed:', ragErr);
    }
    
    // Resolve category names and budget entries (query-filtered, pipe-separated, top 20 max)
    const cats = contextData?.budgetCategories || [];
    const rawEntries = contextData?.budgetEntries || contextData?.budgets || [];
    const catMap = new Map(cats.map((c: any) => [c?.id, c?.name || c?.title || '미분류']));

    const filteredEntries = rawEntries.filter((e: any) => {
      const catName = catMap.get(e?.categoryId) || '';
      const text = `${e?.date || ''} ${e?.purpose || ''} ${catName}`.toLowerCase();
      return queryKeywords.some((kw: string) => text.includes(kw));
    });
    const entries = (filteredEntries.length > 0 ? filteredEntries : rawEntries)
      .sort((a: any, b: any) => (b?.date || '').localeCompare(a?.date || ''))
      .slice(0, 20);
    
    const budgetCategoriesText = cats.map((c: any) => `- [예산항목] ${c?.name || c?.title || '미분류'} (총예산: ${c?.totalBudget || 0}원)`).join('\n') || '없음';
    const budgetEntriesText = entries.map((b: any) => {
      const catName = catMap.get(b.categoryId) || '분류되지않음';
      return `${b.date}|${catName}|${b.purpose}|${b.amount}원`;
    }).join('\n') || '없음';

    const systemPrompt = `<system_instruction>
당신은 ${appMode || 'HCHPS'} 포트폴리오의 행정 전문 AI 비서입니다.
대한민국 공공기관(보건소·구청) 실무관/사무관 수준의 '공문서 표준 개조식 문체'를 준수하여 답변해야 합니다.

<administrative_standards>
1. [공문서 개조식 어조 및 종결어미 원칙]:
   - 불필요한 친근감 표명, 미사여구, 감정적 수식어, 구어체 및 사족 종결어미("~하겠습니다", "~인 것 같습니다", "~했는데요" 등)를 엄격히 배제하세요.
   - 문장 종결은 반드시 명사형 종결 또는 간결한 개조식 종결어미(-조치 완료함, -반영함, -확인됨, -추진 예정임, -계획을 수립함, -판단됨)를 적용하세요.
   - 공식 평서 서술 필요 시에만 절제된 행정 보고체(-보고합니다, -알려드립니다)를 사용하세요.
2. [두괄식 원칙]: 핵심 결론 및 추진 실적을 최상단에 우선 배치하고, 하위에 구체적 근거와 세부 내역을 전개하세요.
3. [다단계 항목 기호 위계 준수]:
   - 1단계: 1. -> 2단계: 가. -> 3단계: 1) -> 4단계: 가)
   - 또는 딩뱃 기호: 󰏚(제목) -> ▢(추진개요) -> ❍(주요내용) -> -(세부실행) -> •(참고사항)
   - 항목 기호 뒤 1칸 띄우기(1. , 가. ), 하위 항목 2칸 들여쓰기를 준수하세요.
4. [행정 표기 규격 준수]:
   - 연월일: 2026. 9. 14. (마침표로 구분하고 '일' 뒤에도 반드시 마침표 및 공백 1칸 부여)
   - 시간: 24시각제 아라비아 숫자 표기(14:00, 09:30~12:20, 콜론 양쪽 공백 없음)
   - 금액: 금10,000,000원(금일천만원) 병기
   - 낫표: 법률/조례/사업명 홑낫표(｢ ｣) 또는 < >, 도서/간행물 겹낫표(『 』)
   - 문서 종결: 답변의 마지막에 2칸 띄우고 '  끝.'을 명시하세요.
5. [행정 어휘 순화 및 중첩어 금지]:
   - 중복 표현(2월달 -> 2월, 기간 동안 -> 기간에, 미리 예측 -> 예측, 새로 신설 -> 신설, 반드시 필요 -> 필요) 사용을 금지합니다.
6. [정보 출처 기반 추론]:
   - 제공된 <database>, <wiki_context>, <knowledge_graph> 안의 정보를 우선하여 신뢰성 높게 유추하세요.
   - <database>에 질문과 관련된 정보가 없는 경우 "현재 등록된 행정 데이터에서는 확인할 수 없음."으로 간결히 명시하세요.
</administrative_standards>
</system_instruction>`;

    // Format history for Gemini using sliding window compaction
    const formattedHistory = compactHistory(messages, 6);

    const knowledgeGraphText = contextData?.knowledgeGraph || '';

    // XML Structured Database for Gemma Attention alignment
    const databaseContext = `<database>
  <signals>
    ${signalsText}
  </signals>
  
  <wiki_context>
    ${matchedWikiText || '없음'}
  </wiki_context>
  
  <knowledge_graph>
    ${knowledgeGraphText || '없음'}
  </knowledge_graph>
  
  <budget_categories>
    ${budgetCategoriesText}
  </budget_categories>
  
  <budget_entries>
    ${budgetEntriesText}
  </budget_entries>
</database>`;

    const promptSuffix = '\n(즉시 질문에 대한 답변만 한국어로 최종 출력하세요.)';
    const optimizedContent = `${databaseContext}\n\n질문: ${lastMessage?.content || ''}${promptSuffix}`;

    const modelsToTry = ['gemini-3.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    let result: any = null;
    let successfulModel = '';
    let apiError: any = null;

    if (genAI) {
      for (const modelName of modelsToTry) {
        try {
          console.log(`[Chat API] Attempting chat with model: ${modelName}`);
          const model = genAI.getGenerativeModel({ 
            model: modelName,
            systemInstruction: systemPrompt,
            generationConfig: {
              maxOutputTokens: 8192,
              temperature: 0.2
            }
          });

          const chat = model.startChat({
            history: formattedHistory,
          });

          let retries = 2;
          while (retries > 0) {
            try {
              if (req.signal?.aborted) {
                throw new DOMException('Aborted', 'AbortError');
              }
              result = await chat.sendMessage(optimizedContent, { signal: req.signal });
              break;
            } catch (err: any) {
              if (err.name === 'AbortError' || req.signal?.aborted) {
                throw err;
              }
              retries--;
              if (retries === 0) throw err;
              console.warn(`[Chat API] ${modelName} call failed, retrying...`, err.message);
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }

          if (result && result.response) {
            successfulModel = modelName;
            break; // Exit loop on success
          }
        } catch (err: any) {
          console.error(`[Chat API] Model ${modelName} failed entirely:`, err.message || err);
          apiError = err;
          if (err.name === 'AbortError' || req.signal?.aborted) {
            break; // AbortError가 감지되면 즉시 다른 모델 시도 중단
          }
        }
      }
    }

    let responseText = '';
    if (result && result.response) {
      const rawResponseText = result.response.text();
      responseText = cleanGemmaResponse(rawResponseText);
      console.log(`[Chat API] Successfully responded using model ${successfulModel}`);
    } else {
      if (req.signal?.aborted || (apiError && apiError.name === 'AbortError')) {
        return NextResponse.json({ error: 'Request aborted' }, { status: 499 });
      }
      console.warn('[Chat API] All generative models exhausted or quota limit reached. Triggering Local RAG Database Fallback.', apiError);
      
      let localAnswer = `📢 [안내: Gemini API 일일 할당량 소진 또는 오프라인 상태로 인해 로컬 RAG 지식베이스 검색 결과로 대체합니다.]\n\n`;
      const queryLower: string = (lastMessage?.content || '').toLowerCase();
      let foundInfo = false;
      
      if (matchedWikiText && matchedWikiText !== '없음') {
        localAnswer += `📁 **지식베이스(Wiki) 검색 결과:**\n`;
        const wikiLines = matchedWikiText.split('\n');
        const relevantWikiLines = wikiLines.filter((l: string) => {
          const cleanLine = l.trim();
          if (!cleanLine) return false;
          return cleanLine.includes('담당') || cleanLine.includes('전화') || cleanLine.includes('이메일') || 
                 /010-\d{4}-\d{4}/.test(cleanLine) || 
                 queryLower.split(' ').some((word: string) => word.length > 1 && cleanLine.toLowerCase().includes(word));
        });
        
        if (relevantWikiLines.length > 0) {
          localAnswer += relevantWikiLines.slice(0, 10).map((l: string) => `  ${l.trim()}`).join('\n') + '\n\n';
          foundInfo = true;
        } else {
          localAnswer += `  ${matchedWikiText.substring(0, 450)}...\n\n`;
          foundInfo = true;
        }
      }
      
      const matchedCategories = cats.filter((c: any) => {
        const catName = c?.name || c?.title || '미분류';
        const nameLower = catName.toLowerCase();
        return (
          queryLower.includes(nameLower) ||
          nameLower.split(' ').some((word: string) => word.length > 1 && queryLower.includes(word))
        );
      });
      
      if (matchedCategories.length > 0) {
        localAnswer += `💰 **관련 예산 항목 조회 결과:**\n`;
        matchedCategories.forEach((c: any) => {
          const catName = c?.name || c?.title || '미분류';
          localAnswer += `  - ${catName}: 총예산 ${Number(c?.totalBudget || 0).toLocaleString()}원\n`;
          const categoryEntries = entries.filter((e: any) => e?.categoryId === c?.id);
          if (categoryEntries.length > 0) {
            localAnswer += `    * 최근 지출 내역:\n`;
            categoryEntries.slice(0, 5).forEach((e: any) => {
              localAnswer += `      - [${e?.date || ''}] ${e?.purpose || ''}: ${Number(e?.amount || 0).toLocaleString()}원\n`;
            });
          }
        });
        localAnswer += '\n';
        foundInfo = true;
      }
      
      if (signalsText && signalsText !== '없음') {
        const relevantSignals = rawSignals.filter((s: any) => 
          queryLower.split(' ').some((word: string) => word.length > 1 && (s.text || '').toLowerCase().includes(word))
        );
        if (relevantSignals.length > 0) {
          localAnswer += `📡 **관련 알림/시그널:**\n`;
          relevantSignals.slice(0, 5).forEach((s: any) => {
            localAnswer += `  - [${s.type || s.category || '알림'}] ${s.text || s.content}\n`;
          });
          localAnswer += '\n';
          foundInfo = true;
        }
      }
      
      if (!foundInfo) {
        localAnswer += `질문하신 내용 "${lastMessage?.content || ''}"에 관한 구체적인 문서를 로컬 데이터베이스에서 찾지 못했습니다.\n`;
        localAnswer += `현재 예산 카테고리는 다음과 같습니다:\n`;
        localAnswer += cats.slice(0, 5).map((c: any) => `  - ${c?.name || c?.title || '미분류'}`).join('\n') + '\n\n';
        localAnswer += `자세한 내용은 상단 메뉴의 '예산관리' 및 '3D 마인드맵' 탭에서 직접 확인하실 수 있습니다.`;
      } else {
        localAnswer += `※ 로컬 RAG 검색 결과이므로 답변의 맥락이 자연스럽지 않을 수 있습니다. API 할당량이 복구되면 더욱 정확한 답변이 가능합니다.`;
      }
      
      responseText = localAnswer;
    }

    return NextResponse.json({ content: responseText });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { content: `죄송합니다. 서버 처리 중 오류가 발생했습니다: ${error.message}` },
      { status: 500 }
    );
  }
}
