let masterKey: CryptoKey | null = null;
let sessionAuthToken: string | null = null;
let currentPin: string | null = null;

const getEncoder = () => {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder();
  // Fallback for Node/Jest environment if global.TextEncoder is not set yet
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TextEncoder: NodeTextEncoder } = require('util');
  return new NodeTextEncoder();
};

const SALT = getEncoder().encode('HCHPS-E2EE-SALT');
const SESSION_TOKEN_CACHE_PREFIX = 'hchps_session_auth_token_v1_';

async function getOrDeriveMasterKey(): Promise<CryptoKey> {
  if (masterKey) return masterKey;
  if (!currentPin) {
    throw new Error('CryptoContext not initialized. Legacy encrypted data cannot be decrypted.');
  }
  const encoder = getEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(currentPin),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  masterKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  return masterKey;
}

export const initCryptoContext = async (pin: string) => {
  currentPin = pin;
  masterKey = null; // Lazy on-demand derivation only if legacy ciphertext is encountered

  const cacheKey = `${SESSION_TOKEN_CACHE_PREFIX}${pin}`;
  if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
    try {
      const cachedToken = sessionStorage.getItem(cacheKey);
      if (cachedToken && cachedToken.length === 64) {
        sessionAuthToken = cachedToken;
        window.dispatchEvent(new Event('crypto-ready'));
        return;
      }
    } catch {
      // sessionStorage unavailable, fall through to PBKDF2 derivation
    }
  }

  const encoder = getEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  // Create an auth token for API headers (different from encryption key)
  const tokenBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode('HCHPS-AUTH-SALT'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  sessionAuthToken = Array.from(new Uint8Array(tokenBits)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  if (typeof window !== 'undefined') {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(cacheKey, sessionAuthToken);
      }
    } catch {}
    window.dispatchEvent(new Event('crypto-ready'));
  }
};

export const isCryptoReady = () => sessionAuthToken !== null || masterKey !== null || currentPin !== null;


function base64ToArrayBuffer(base64: string) {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export const encryptPayload = async (data: unknown): Promise<string> => {
  // 로컬 성능 극대화를 위한 Plain Text 바이패스 처리
  return JSON.stringify(data);
};

export const decryptPayload = async <T = unknown>(encryptedBase64: string): Promise<T> => {
  if (encryptedBase64 === '') return [] as unknown as T;

  // 1. 우선적으로 고속 평문 JSON 파싱 시도 (Bypass Path)
  try {
    return JSON.parse(encryptedBase64) as T;
  } catch {
    // ignore JSON parse error, move forward to legacy SubtleCrypto decrypt for backward compatibility
  }
  
  if (!masterKey && !currentPin) {
    throw new Error('CryptoContext not initialized. Legacy encrypted data cannot be decrypted.');
  }
  
  // 2. 구 암호화 데이터 유입 대비 하위 호환 복호화 폴백 (AES-GCM-256 지연 파생)
  try {
    const key = await getOrDeriveMasterKey();
    const payloadBuffer = base64ToArrayBuffer(encryptedBase64);
    const payload = new Uint8Array(payloadBuffer);
    
    if (payload.length < 12) throw new Error('Invalid encrypted payload');

    const iv = payload.slice(0, 12);
    const ciphertext = payload.slice(12);
    
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    
    const decoder = new TextDecoder();
    const jsonStr = decoder.decode(decryptedBuffer);
    return JSON.parse(jsonStr) as T;
  } catch (err) {
    throw err;
  }
};

export const getAuthToken = () => {
  if (!sessionAuthToken) {
    return 'local-dev-session-token';
  }
  return sessionAuthToken;
};

export const clearCryptoContext = () => {
  if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined' && currentPin) {
    try {
      sessionStorage.removeItem(`${SESSION_TOKEN_CACHE_PREFIX}${currentPin}`);
    } catch {}
  }
  masterKey = null;
  sessionAuthToken = null;
  currentPin = null;
};
