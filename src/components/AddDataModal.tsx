import React, { useState, useCallback } from 'react';
import { X, Zap, FileText } from 'lucide-react';

interface AddDataModalProps {
 isOpen: boolean;
 initialMode?: 'memo' | 'pdf';
 onClose: () => void;
 onAddSignal: (text: string) => void;
 onAddTask: (title: string, desc: string) => void;
 onAddMeeting: (title: string, notes: string) => void;
}

function AddDataModalComponent({ isOpen, initialMode = 'memo', onClose, onAddSignal, onAddTask, onAddMeeting }: AddDataModalProps) {
 const [mode, setMode] = useState<'memo' | 'pdf'>(initialMode);
 const [type] = useState<'signal' | 'task' | 'meeting'>('signal');
 const [title, setTitle] = useState('');
 const [content, setContent] = useState('');
 const [isParsing, setIsParsing] = useState(false);

 const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
 setContent(e.target.value);
  }, []);

 React.useEffect(() => {
 if (isOpen) {
 setMode(initialMode);
 setContent('');
 setIsParsing(false);
    }
  }, [isOpen, initialMode]);

 const handlePdfUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 setIsParsing(true);
 try {
      // SSR(서버 사이드) 렌더링 시 DOMMatrix undefined 에러를 방지하기 위해 사용 시점에 동적 로드
 const pdfjsLib = await import('pdfjs-dist');
 pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

 const arrayBuffer = await file.arrayBuffer();
 const pdf = await pdfjsLib.getDocument({ 
 data: arrayBuffer,
 cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
 cMapPacked: true,
      }).promise;
 let extractedText = `[PDF 원본: ${file.name}]\n\n`;
 let actualTextCount = 0;
      
 for (let i = 1; i <= pdf.numPages; i++) {
 const page = await pdf.getPage(i);
 const textContent = await page.getTextContent();
 const items = textContent.items;
 let pageText = '';
 for (let j = 0; j < items.length; j++) {
 const str = (items[j] as { str?: string }).str;
 if (str) {
 pageText += (pageText ? ' ' : '') + str;
          }
        }
 if (pageText.trim()) actualTextCount++;
 extractedText += pageText + '\n\n';
      }

 if (actualTextCount === 0) {
 extractedText += "\n💡 [알림]: 이 PDF는 텍스트가 없는 스캔본(이미지)입니다. 어도비 아크로뱃이나 알PDF 등에서 [텍스트 인식(OCR)]을 한 번 돌린 후 다시 업로드하시면 완벽하게 추출됩니다.";
      }

 setContent((prev) => prev + (prev ? '\n\n' : '') + extractedText.trim());
    } catch (err) {
 console.log('[AddDataModal] PDF text extraction error:', err);
 alert('PDF 텍스트 추출 중 오류가 발생했습니다.');
    } finally {
 setIsParsing(false);
 e.target.value = '';
    }
  }, []);

 const handleSubmit = useCallback(() => {
 if (!title.trim() && type !== 'signal') {
 alert('제목을 입력해주세요.');
 return;
    }
 if (type === 'signal' && !content.trim()) {
 alert('내용을 입력해주세요.');
 return;
    }

 if (type === 'signal') onAddSignal(content);
 if (type === 'task') onAddTask(title, content);
 if (type === 'meeting') onAddMeeting(title, content);
    
 setTitle(''); 
 setContent('');
 onClose();
  }, [title, type, content, onAddSignal, onAddTask, onAddMeeting, onClose]);

 if (!isOpen) return null;

 return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-md w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className={`flex justify-between items-center p-4 border-b border-gray-100 transition-colors shrink-0 ${mode === 'memo' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
          <h2 className="text-lg font-bold flex items-center gap-2">
            {mode === 'memo' ? <><Zap size={20} className="text-emerald-500" /> 빠른 메모 작성</> : <><FileText size={20} className="text-amber-500" /> PDF 문서 지식화</>}
          </h2>
          <button onClick={onClose} className={`p-1 rounded-full transition-colors cursor-pointer ${mode === 'memo' ? 'hover:bg-emerald-100 text-emerald-700' : 'hover:bg-amber-100 text-amber-700'}`}>
            <X size={20} />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          {mode === 'memo' && (
            <div className="space-y-3 h-full flex flex-col">
              <p className="text-xs text-gray-500 px-1 -mt-1 shrink-0">
                아이디어 · 메모 즉시 기록 · 추후 위키 연동
              </p>
              <div className="px-1 flex-1 flex flex-col">
                <label className="block text-xs font-semibold text-gray-600 mb-1 shrink-0">
                  시그널 내용
                </label>
                <textarea 
 value={content}
 onChange={handleContentChange}
 placeholder="메모 · 아이디어 입력"
 className="w-full flex-1 border border-gray-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent min-h-[300px] resize-none"
 autoFocus
                />
              </div>
            </div>
          )}

          {mode === 'pdf' && (
            <div className="space-y-3 h-full flex flex-col">
              <p className="text-xs text-gray-500 px-1 -mt-1 shrink-0">
 PDF 업로드 → 텍스트 자동 추출 · 저장 전 편집 가능
              </p>
              <div className="px-1 flex-1 flex flex-col">
                <label className="block text-xs font-semibold text-gray-600 mb-2 shrink-0">
                  {content ? '추출된 원문 (수정 가능)' : 'PDF 원본 업로드'}
                </label>
                
                {!content ? (
                  <label 
 htmlFor="pdf-upload" 
 className={`flex flex-col items-center justify-center gap-3 w-full h-[300px] border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-150 ${isParsing ? 'bg-amber-50 border-amber-300 pointer-events-none' : 'bg-gray-50 border-gray-200 hover:bg-amber-50/50 hover:border-amber-300'}`}
                  >
                    <input 
 type="file" 
 accept="application/pdf"
 id="pdf-upload"
 className="hidden"
 onChange={handlePdfUpload}
                    />
                    <FileText size={48} className={isParsing ? 'text-amber-400 animate-pulse' : 'text-gray-400'} />
                    <div className="text-center">
                      <p className="text-base font-bold text-gray-700">
                        {isParsing ? '문서 분석 · 텍스트 추출 중' : 'PDF 파일 선택'}
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        {isParsing ? '수 초 소요' : '브라우저 로컬 처리 (외부 전송 없음)'}
                      </p>
                    </div>
                  </label>
                ) : (
                  <textarea 
 value={content}
 onChange={handleContentChange}
 placeholder="추출 텍스트 없음"
 className="w-full flex-1 border border-gray-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent min-h-[300px] resize-none"
 autoFocus
                  />
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50 transition-colors rounded-b-xl shrink-0">
          <button 
 onClick={onClose}
 className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
          >
            취소
          </button>
          {(!isParsing && (mode === 'memo' || content)) && (
            <button 
 onClick={handleSubmit}
 className={`px-6 py-2.5 text-sm font-bold text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${mode === 'memo' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700 shadow-sm'}`}
            >
              <Zap size={16} className="fill-white" />
              {mode === 'memo' ? '저장하기' : 'PDF 텍스트 지식화'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

AddDataModalComponent.displayName = 'AddDataModal';
export const AddDataModal = React.memo(AddDataModalComponent);
