/**
 * VITAL Administrative Document Formatter & Linter
 * 대한민국 공공기관 공문서 표준 규격(대통령령 행정 효율과 협업 촉진에 관한 규정 및 AGENTS.md Rule M 준거)
 */

/**
 * 1. 연월일 표준 표기 변환: YYYY. M. D. (일 뒤 마침표 필수, 각 단위 사이 1칸 공백)
 * 예: "2026-09-14", "2026.9.14", "'26. 9. 14" -> "2026. 9. 14."
 */
export function formatAdministrativeDate(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim().replace(/^['`]/, '');
  
  // Match YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD, etc.
  const match = trimmed.match(/^(\d{2,4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})[일.\s]*$/);
  if (match) {
    let year = match[1];
    if (year.length === 2) {
      year = `20${year}`;
    }
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    return `${year}. ${month}. ${day}.`;
  }
  
  return raw;
}

/**
 * 2. 24시각제 시간 표준 표기: HH:mm (콜론 양쪽 공백 없음, 시와 분 사이 쌍점 표기)
 * 예: "오후 2시" -> "14:00", "09:30 - 12:20" -> "09:30~12:20"
 */
export function formatAdministrativeTime(raw: string): string {
  if (!raw) return '';
  let text = raw.trim();

  // 오후/오전 변환
  text = text.replace(/오전\s*(\d{1,2})시?/g, (_, h) => {
    const hour = parseInt(h, 10).toString().padStart(2, '0');
    return `${hour}:00`;
  });
  text = text.replace(/오후\s*(\d{1,2})시?/g, (_, h) => {
    let hour = parseInt(h, 10);
    if (hour < 12) hour += 12;
    return `${hour.toString().padStart(2, '0')}:00`;
  });

  // 단순 시 표기 변환: "14시" -> "14:00"
  text = text.replace(/(\d{1,2})시(?!\d)/g, (_, h) => {
    const hour = parseInt(h, 10).toString().padStart(2, '0');
    return `${hour}:00`;
  });

  // 콜론 양쪽 공백 제거
  text = text.replace(/\s*:\s*/g, ':');

  // 시간 범위 물결표 표준화
  text = text.replace(/(\d{2}:\d{2})\s*[-~～]\s*(\d{2}:\d{2})/g, '$1~$2');

  return text;
}

/**
 * 3. 숫자를 공문서 한글 금액으로 변환 (위조 방지용 병기)
 * 예: 10000000 -> "금일천만원", 13500 -> "금일만삼천오백원"
 */
export function numberToKoreanHanja(amount: number): string {
  if (amount === 0) return '금영원';
  if (!Number.isFinite(amount) || amount < 0) return '';

  const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  const smallUnits = ['', '십', '백', '천'];
  const largeUnits = ['', '만', '억', '조'];

  let result = '';
  let unitIndex = 0;
  let temp = Math.floor(amount);

  while (temp > 0) {
    const chunk = temp % 10000;
    if (chunk > 0) {
      let chunkStr = '';
      let chunkTemp = chunk;
      for (let i = 0; i < 4; i++) {
        const d = chunkTemp % 10;
        if (d > 0) {
          chunkStr = digits[d] + smallUnits[i] + chunkStr;
        }
        chunkTemp = Math.floor(chunkTemp / 10);
      }
      result = chunkStr + largeUnits[unitIndex] + result;
    }
    unitIndex++;
    temp = Math.floor(temp / 10000);
  }

  return `금${result}원`;
}

/**
 * 4. 공문서 표준 금액 병기 포맷: 금10,000,000원(금일천만원)
 */
export function formatAdministrativeCurrency(amount: number): string {
  const formattedNumber = amount.toLocaleString('ko-KR');
  const koreanWords = numberToKoreanHanja(amount);
  return `금${formattedNumber}원(${koreanWords})`;
}

/**
 * 5. 공문서 중첩어 및 비표준 오류 표현 사전 (행정안전부/국어문화원 표준)
 */
export const ADMINISTRATIVE_REDUNDANCY_MAP: Record<string, string> = {
  '2월달': '2월',
  '1월달': '1월',
  '3월달': '3월',
  '4월달': '4월',
  '5월달': '5월',
  '6월달': '6월',
  '7월달': '7월',
  '8월달': '8월',
  '9월달': '9월',
  '10월달': '10월',
  '11월달': '11월',
  '12월달': '12월',
  '기간 동안': '기간에',
  '기간중에': '기간 중',
  '일년동안': '1년간',
  '월요일 날': '월요일',
  '화요일 날': '화요일',
  '수요일 날': '수요일',
  '목요일 날': '목요일',
  '금요일 날': '금요일',
  '토요일 날': '토요일',
  '일요일 날': '일요일',
  '미리 예측': '예측',
  '새로 신설': '신설',
  '반드시 필요': '필요',
  '안전선 밖으로': '안전선 안으로',
  '자문을 구하다': '자문하다',
  '자문을 구하여': '자문을 받아',
  '가사일': '가사',
  '여러 가지 종류': '여러 종류',
  '새로 나온 신상품': '신상품',
  '소급하여 올라가다': '소급하다',
  '호칭을 부르다': '호칭하다',
  '시범 보이다': '시범하다',
  '피해를 입다': '해를 입다'
};

/**
 * 6. 구어체 종결어미 행정 개조식 교정 매핑
 */
export const ADMINISTRATIVE_ENDING_MAP: [RegExp, string][] = [
  [/조치하였습니다(?=[.\s,!?]|$)/g, '조치 완료함'],
  [/조치했습니다(?=[.\s,!?]|$)/g, '조치 완료함'],
  [/완료하였습니다(?=[.\s,!?]|$)/g, '완료함'],
  [/완료했습니다(?=[.\s,!?]|$)/g, '완료함'],
  [/반영하였습니다(?=[.\s,!?]|$)/g, '반영함'],
  [/반영했습니다(?=[.\s,!?]|$)/g, '반영함'],
  [/구현하였습니다(?=[.\s,!?]|$)/g, '구현함'],
  [/구현했습니다(?=[.\s,!?]|$)/g, '구현함'],
  [/수립하였습니다(?=[.\s,!?]|$)/g, '수립함'],
  [/수립했습니다(?=[.\s,!?]|$)/g, '수립함'],
  [/추진하겠습니다(?=[.\s,!?]|$)/g, '추진 예정임'],
  [/진행하겠습니다(?=[.\s,!?]|$)/g, '진행 예정임'],
  [/살펴보겠습니다(?=[.\s,!?]|$)/g, '검토함'],
  [/확인되었습니다(?=[.\s,!?]|$)/g, '확인됨'],
  [/판단됩니다(?=[.\s,!?]|$)/g, '판단됨'],
  [/예정입니다(?=[.\s,!?]|$)/g, '예정임'],
  [/생각됩니다(?=[.\s,!?]|$)/g, '판단됨'],
  [/인 것 같습니다(?=[.\s,!?]|$)/g, '으로 사료됨'],
  [/하였습니다(?=[.\s,!?]|$)/g, '하였음'],
  [/했습니다(?=[.\s,!?]|$)/g, '함']
];

/**
 * 7. 공문서 본문 린터 및 새니타이저
 */
export function sanitizeAdministrativeText(text: string): string {
  if (!text) return '';

  let sanitized = text;

  // 1) 중첩어 일괄 정제
  for (const [redundant, replacement] of Object.entries(ADMINISTRATIVE_REDUNDANCY_MAP)) {
    sanitized = sanitized.replaceAll(redundant, replacement);
  }

  // 2) 구어체 종결어미 개조식 변환
  for (const [pattern, replacement] of ADMINISTRATIVE_ENDING_MAP) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  // 3) 비표준 날짜 표기 자동 보정: "2026.09.14" -> "2026. 9. 14."
  sanitized = sanitized.replace(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})(?!\d)/g, (_, y, m, d) => {
    return `${y}. ${parseInt(m, 10)}. ${parseInt(d, 10)}.`;
  });

  return sanitized;
}

/**
 * 8. 공문서 끝 표시 보정
 */
export function ensureAdministrativeEnding(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.endsWith('끝.') || trimmed.endsWith('끝')) {
    return trimmed;
  }
  return `${trimmed}  끝.`;
}
