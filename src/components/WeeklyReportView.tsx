import React, { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { FileText, CalendarDays, UploadCloud } from 'lucide-react';

interface WeeklyReportViewProps {
 addSignal?: (text: string) => void;
}



function WeeklyReportViewComponent({ addSignal }: WeeklyReportViewProps) {
 const [extractedRawText, setExtractedRawText] = useState<string>('');
 const [isProcessing, setIsProcessing] = useState(false);
 const fileInputRef = useRef<HTMLInputElement>(null);

 const handlePdfUpload = React.useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 setIsProcessing(true);
 try {
 const pdfjsLib = await import('pdfjs-dist');
 pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

 const arrayBuffer = await file.arrayBuffer();
      // Required for pure Korean PDF
 const loadingTask = pdfjsLib.getDocument({
 data: arrayBuffer,
 cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
 cMapPacked: true,
      });

 const pdf = await loadingTask.promise;
 let extractedText = `[주간업무 보고: ${file.name}]\n\n`;

 for (let i = 1; i <= pdf.numPages; i++) {
 const page = await pdf.getPage(i);
 const textContent = await page.getTextContent();
 const items = textContent.items;
 const len = items.length;
 let pageText = '';
 for (let j = 0; j < len; j++) {
 const str = (items[j] as { str?: string })?.str;
 if (str) {
 pageText += (pageText ? ' ' : '') + str;
          }
        }
 extractedText += pageText + '\n\n';
      }

 setExtractedRawText(extractedText);
    } catch (err) {
 console.log('PDF parsing error:', err);
 alert('PDF 처리에 실패했습니다. 브라우저 콘솔을 확인하세요.');
    } finally {
 setIsProcessing(false);
 if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

 const handleOpenFilePicker = React.useCallback(() => {
 fileInputRef.current?.click();
  }, []);

 const handleReset = React.useCallback(() => {
 setExtractedRawText('');
  }, []);

 const handleSendToSignal = React.useCallback(() => {
 if (!extractedRawText) return;
 addSignal?.(`[주간보고 정리 원문]\n${extractedRawText.substring(0, 300)}...`);
 alert('데이터가 메모장으로 이동되었습니다.');
 setExtractedRawText('');
  }, [addSignal, extractedRawText]);

 return (
    <div className="space-y-6 flex flex-col h-full max-w-5xl mx-auto">
      <div className="flex flex-col gap-2 pt-6 pb-2">
        <h1 className="text-3xl font-extrabold text-[var(--color-text-primary)] tracking-tight flex items-center gap-3">
          <CalendarDays className="text-purple-500" size={32} />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600">
            주간업무 리포트
          </span>
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)]">주간보고 PDF 업로드 · 실적 · 일정 자동 분석</p>
      </div>

      <Card className="p-8 border-2 border-dashed border-purple-200 bg-purple-50/30">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="h-16 w-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-2">
            <UploadCloud size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-800">주간보고 PDF 업로드</h3>
          <p className="text-sm text-gray-500 text-center max-w-sm">
 PDF 드롭 · 버튼 선택 등록
          </p>
          <input
 ref={fileInputRef}
 type="file"
 accept=".pdf"
 className="hidden"
 onChange={handlePdfUpload}
          />
          <button
 onClick={handleOpenFilePicker}
 disabled={isProcessing}
 className="mt-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl shadow-lg hover:opacity-90 transition-colors duration-150 font-semibold"
          >
            {isProcessing ? '스캔 분석 중...' : 'PDF 파일 선택하기'}
          </button>
        </div>
      </Card>

      {extractedRawText && (
        <Card className="p-6 bg-white border border-gray-200">
          <h3 className="text-base font-bold mb-4 flex items-center gap-2">
            <FileText size={18} className="text-gray-500" /> 추출된 원시 데이터
          </h3>
          <textarea 
 className="w-full h-64 p-4 border rounded-xl text-sm leading-relaxed custom-scrollbar bg-gray-50 text-gray-700"
 value={extractedRawText}
 readOnly
          />
          <div className="flex justify-end gap-3 mt-4">
             <button
 onClick={handleReset}
 className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-600"
             >
               초기화
             </button>
             <button 
 onClick={handleSendToSignal}
 className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:opacity-90 transition-colors duration-150 flex items-center gap-2"
             >
               데이터 메모로 전송하기
             </button>
          </div>
        </Card>
      )}
    </div>
  );
}

WeeklyReportViewComponent.displayName = 'WeeklyReportView';
export const WeeklyReportView = React.memo(WeeklyReportViewComponent);
