interface BlockItemLike {
  content?: unknown;
  children?: unknown;
}

function extractBlocksToChunks(blocks: unknown[], chunks: string[]): void {
  if (!blocks || !Array.isArray(blocks)) return;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i] as BlockItemLike | undefined;
    if (!block) continue;
    if (block.content) {
      if (typeof block.content === 'string') {
        chunks.push(block.content, '\n');
      } else if (Array.isArray(block.content)) {
        for (let j = 0; j < block.content.length; j++) {
          const inline = block.content[j] as { type?: string; text?: string } | string | undefined;
          if (typeof inline === 'string') {
            chunks.push(inline);
          } else if (inline && typeof inline === 'object') {
            if (inline.type === 'text' && typeof inline.text === 'string') {
              chunks.push(inline.text);
            } else if (typeof (inline as { text?: string }).text === 'string') {
              chunks.push((inline as { text: string }).text);
            }
          }
        }
        chunks.push('\n');
      }
    }
    if (block.children && Array.isArray(block.children)) {
      extractBlocksToChunks(block.children, chunks);
    }
  }
}

export function extractRawTextFromBlocks(blocks: unknown[] | undefined | null): string {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) return '';
  const chunks: string[] = [];
  extractBlocksToChunks(blocks, chunks);
  return chunks.join('');
}

export interface ExtractedContact {
  phones: string[];
  emails: string[];
}

const PHONE_REGEX = /(01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}|02[-.\s]?\d{3,4}[-.\s]?\d{4}|0[3-9]\d[-.\s]?\d{3,4}[-.\s]?\d{4})/g;
const EMAIL_REGEX = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

export function parseContacts(text: string): ExtractedContact {
  if (!text) return { phones: [], emails: [] };
  
  PHONE_REGEX.lastIndex = 0;
  EMAIL_REGEX.lastIndex = 0;
  
  const phonesSet = new Set<string>();
  const emailsSet = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = PHONE_REGEX.exec(text)) !== null) {
    phonesSet.add(match[0]);
  }
  while ((match = EMAIL_REGEX.exec(text)) !== null) {
    emailsSet.add(match[0]);
  }

  return {
    phones: Array.from(phonesSet),
    emails: Array.from(emailsSet)
  };
}

/**
 * 전화번호 및 휴대전화 자동 하이픈 포맷터 (Auto-Hyphen)
 * - 02 서울 유선 (9~10자리): 02-XXX-XXXX (9자리) 또는 02-XXXX-XXXX (10자리)
 * - 010 이동통신 (11자리): 010-XXXX-XXXX
 * - 01X 기타 이동통신 및 031/051 등 지역번호, 070, 050: 0XX-XXX-XXXX 또는 0XX-XXXX-XXXX
 * - 1588, 1544 등 전국대표번호 (8자리): 1588-XXXX
 * - 4자리 원내 내선번호: 원형 보존
 */
export function formatAutoHyphen(value: string | undefined | null): string {
  if (!value) return '';
  const str = String(value).trim();
  if (!str) return '';

  const digits = str.replace(/[^0-9]/g, '');
  if (!digits) return str;

  // 4자리 내선번호
  if (digits.length === 4) return digits;

  // 1588 등 대표번호 8자리
  if (digits.length === 8 && (digits.startsWith('15') || digits.startsWith('16') || digits.startsWith('18'))) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  // 서울 02
  if (digits.startsWith('02')) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    if (digits.length === 9) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    }
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }

  // 이동통신 010 (11자리)
  if (digits.startsWith('010')) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }

  // 기타 이동통신(011 등) 및 지역번호(031, 051 등), 070, 050
  if (digits.startsWith('0')) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    if (digits.length <= 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }

  return str;
}

