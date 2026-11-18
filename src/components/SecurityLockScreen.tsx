import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Unlock } from 'lucide-react';

interface Props {
  hasSetupPIN: boolean;
  failCount: number;
  onVerify: (pin: string) => Promise<boolean>;
  onSetup: (pin: string) => void;
  appMode?: 'HCHPS' | 'VITAL';
}

const PIN_LENGTH = 4;
const PIN_INDICES = [0, 1, 2, 3];
const NUM_PAD_DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const SecurityLockScreenComponent: React.FC<Props> = ({ hasSetupPIN, onVerify, onSetup, appMode = 'VITAL' }) => {
  const [pin, setPin] = useState<string>('');
  const [setupStep, setSetupStep] = useState<1 | 2>(1);
  const [firstPin, setFirstPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isShaking, setIsShaking] = useState(false);

  // Trigger shake animation
  const triggerError = useCallback((msg: string) => {
    setErrorMsg(msg);
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
    setPin('');
  }, []);

  const handlePinComplete = useCallback(async (currentPin: string) => {
    if (hasSetupPIN) {
      const isValid = await onVerify(currentPin);
      if (!isValid) {
        triggerError('PIN 불일치 · 재입력 필요');
      }
    } else {
      if (setupStep === 1) {
        setFirstPin(currentPin);
        setSetupStep(2);
        setPin('');
      } else {
        if (currentPin === firstPin) {
          onSetup(currentPin);
        } else {
          setSetupStep(1);
          setFirstPin('');
          triggerError('PIN 불일치 · 처음부터 재설정');
        }
      }
    }
  }, [hasSetupPIN, onVerify, setupStep, firstPin, onSetup, triggerError]);

  const processDigit = useCallback((digit: string) => {
    if (pin.length < PIN_LENGTH) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorMsg('');
      if (nextPin.length === PIN_LENGTH) {
        handlePinComplete(nextPin);
      }
    }
  }, [pin, handlePinComplete]);

  // 물리적 키보드(키패드) 입력 지원
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // 숫자 키 입력
    if (e.key >= '0' && e.key <= '9') {
      processDigit(e.key);
    } 
    // 백스페이스 및 삭제 
    else if (e.key === 'Backspace' || e.key === 'Delete') {
      setPin(prev => prev.slice(0, -1));
      setErrorMsg('');
    }
  }, [processDigit]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleNumberClick = (n: number) => {
    processDigit(n.toString());
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col items-center justify-center p-6 sm:p-8">
      
      {/* 락 아이콘 */}
      <div className="mb-8 p-4 bg-slate-800/50 rounded-full shadow-lg border border-slate-700/50">
        {hasSetupPIN ? (
          <Lock size={32} className="text-blue-400" />
        ) : (
          <Unlock size={32} className="text-emerald-400" />
        )}
      </div>

      {/* 안내 메시지 */}
      <div className="text-center mb-8 h-16">
        <h2 className="text-xl font-bold text-white mb-2 tracking-tight">
          {hasSetupPIN 
            ? `${appMode} 시스템 잠금 해제` 
            : setupStep === 1 ? '신규 접근 PIN 설정' : '접근 PIN 재입력 확인'}
        </h2>
        <p className={`text-sm ${errorMsg ? 'text-red-400' : 'text-slate-400'}`}>
          {errorMsg || (hasSetupPIN ? '4자리 PIN 입력' : '4자리 숫자 PIN 선택')}
        </p>
      </div>

      {/* 핀 도트 */}
      <div className={`flex gap-4 mb-12 ${isShaking ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
        {PIN_INDICES.map((i) => (
          <div 
            key={i} 
            className={`w-4 h-4 rounded-full border-2 transition-colors duration-200 ${
              i < pin.length 
                ? 'bg-blue-500 border-blue-500 scale-110 shadow-[0_0_10px_rgba(59,130,246,0.6)]' 
                : 'bg-transparent border-slate-600'
            }`}
          />
        ))}
      </div>

      {/* 숫자 패드 */}
      <div className="grid grid-cols-3 gap-x-8 gap-y-6 max-w-[280px] w-full">
        {NUM_PAD_DIGITS.map((n) => (
          <button
            key={n}
            onClick={() => handleNumberClick(n)}
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl text-slate-200 font-medium hover:bg-slate-800 transition-colors active:scale-95 mx-auto"
          >
            {n}
          </button>
        ))}
        <div /> {/* 빈 칸 */}
        <button
          onClick={() => handleNumberClick(0)}
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl text-slate-200 font-medium hover:bg-slate-800 transition-colors active:scale-95 mx-auto"
        >
          0
        </button>
        <button
          onClick={handleDelete}
          className="w-16 h-16 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors active:scale-95 mx-auto text-lg"
        >
          지우기
        </button>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-10px); }
          80% { transform: translateX(10px); }
        }
      `}} />
    </div>
  );
};

SecurityLockScreenComponent.displayName = 'SecurityLockScreen';
export const SecurityLockScreen = React.memo(SecurityLockScreenComponent);
