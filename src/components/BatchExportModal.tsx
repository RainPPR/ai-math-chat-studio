import React, { useState } from 'react';
import JSZip from 'jszip';
import { ChatSession } from '../types';
import { api } from '../lib/api';
import { stripThinking } from '../../shared/thinking';
import { Download, X, Loader2, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

interface BatchExportModalProps {
  selectedSessionIds: string[];
  sessions: ChatSession[];
  onClose: () => void;
  onSuccess?: () => void;
}

export const BatchExportModal: React.FC<BatchExportModalProps> = ({
  selectedSessionIds,
  sessions,
  onClose,
  onSuccess,
}) => {
  const [includeThinking, setIncludeThinking] = useState(true);
  const [extension, setExtension] = useState<'md' | 'txt'>('md');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: selectedSessionIds.length });
  const [error, setError] = useState<string | null>(null);

  const handleStartExport = async () => {
    if (selectedSessionIds.length === 0 || isExporting) return;

    setIsExporting(true);
    setError(null);
    setProgress({ current: 0, total: selectedSessionIds.length });

    try {
      const zip = new JSZip();
      const usedFilenames = new Set<string>();

      for (let i = 0; i < selectedSessionIds.length; i++) {
        const id = selectedSessionIds[i];
        let session: ChatSession;

        try {
          session = await api.sessions.get(id);
        } catch {
          // Fallback to in-memory session if fetch fails
          const found = sessions.find(s => s.id === id);
          if (!found) continue;
          session = found;
        }

        let text = `# ${session.title || 'Untitled Session'}\n\n`;
        if (session.messages && session.messages.length > 0) {
          session.messages.forEach(msg => {
            const roleLabel = msg.role === 'user' ? 'User' : 'AI';
            let msgContent = msg.content || '';
            if (!includeThinking) {
              msgContent = stripThinking(msgContent);
            }
            text += `### ${roleLabel}\n${msgContent}\n\n`;
          });
        }

        const rawTitle = (session.title || 'Untitled').trim();
        let baseName = rawTitle.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, ' ');
        if (!baseName) baseName = 'Untitled';

        let fileName = `${baseName}.${extension}`;
        let counter = 2;
        while (usedFilenames.has(fileName.toLowerCase())) {
          fileName = `${baseName}_${counter}.${extension}`;
          counter++;
        }
        usedFilenames.add(fileName.toLowerCase());

        zip.file(fileName, text);
        setProgress({ current: i + 1, total: selectedSessionIds.length });

        if (i % 5 === 0) {
          await new Promise(r => setTimeout(r, 0));
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timeStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const zipFilename = `batch_export_${timeStr}.zip`;

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || '导出过程发生错误，请重试');
      setIsExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-gray-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-export-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isExporting) {
          onClose();
        }
      }}
    >
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-200">
            <Download size={18} className="text-blue-400" />
            <h3 id="batch-export-modal-title" className="text-base font-semibold">
              批量导出会话
            </h3>
          </div>
          {!isExporting && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors cursor-pointer"
              title="关闭"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          <div className="text-xs text-gray-400">
            已选择 <span className="text-blue-400 font-semibold">{selectedSessionIds.length}</span> 个会话打包导出为 .zip 文件。
          </div>

          {error && (
            <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg flex items-center gap-2 text-xs text-red-200">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Option: Thinking process */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-300">
              思考过程 (&lt;think&gt;)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isExporting}
                onClick={() => setIncludeThinking(true)}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  includeThinking
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                    : 'bg-gray-800/60 border-gray-700/60 text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
              >
                <CheckCircle2 size={14} className={includeThinking ? 'text-blue-400' : 'opacity-0'} />
                <span>保留思考过程</span>
              </button>
              <button
                type="button"
                disabled={isExporting}
                onClick={() => setIncludeThinking(false)}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  !includeThinking
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                    : 'bg-gray-800/60 border-gray-700/60 text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
              >
                <CheckCircle2 size={14} className={!includeThinking ? 'text-blue-400' : 'opacity-0'} />
                <span>移除思考过程</span>
              </button>
            </div>
          </div>

          {/* Option: File extension */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-300">
              文件扩展名
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isExporting}
                onClick={() => setExtension('md')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  extension === 'md'
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                    : 'bg-gray-800/60 border-gray-700/60 text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
              >
                <FileText size={14} className="text-blue-400" />
                <span>Markdown (.md)</span>
              </button>
              <button
                type="button"
                disabled={isExporting}
                onClick={() => setExtension('txt')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  extension === 'txt'
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                    : 'bg-gray-800/60 border-gray-700/60 text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
              >
                <FileText size={14} className="text-gray-400" />
                <span>纯文本 (.txt)</span>
              </button>
            </div>
          </div>

          {/* Progress Indicator */}
          {isExporting && (
            <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-300">
                <span className="flex items-center gap-1.5 text-blue-400 font-medium">
                  <Loader2 size={14} className="animate-spin" />
                  <span>正在生成 ZIP 压缩包...</span>
                </span>
                <span className="font-mono text-gray-400">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-500 h-full transition-all duration-150 rounded-full"
                  style={{
                    width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%'
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleStartExport}
            disabled={isExporting || selectedSessionIds.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>打包中...</span>
              </>
            ) : (
              <>
                <Download size={14} />
                <span>开始打包下载</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
