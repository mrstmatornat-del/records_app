import React, { useState } from 'react';
import { LocalEngineConfig } from '../utils/localModelEngine';
import { Cpu, Server, Zap, CheckCircle2, AlertCircle, X, RefreshCw, Terminal, Info, ShieldCheck } from 'lucide-react';

interface LocalModelSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: LocalEngineConfig;
  onSaveConfig: (newConfig: LocalEngineConfig) => void;
}

export const LocalModelSettingsModal: React.FC<LocalModelSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [engineType, setEngineType] = useState<'gemini' | 'local-ollama' | 'local-fast'>(config.engineType);
  const [ollamaUrl, setOllamaUrl] = useState(config.ollamaUrl);
  const [ollamaModel, setOllamaModel] = useState(config.ollamaModel);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; models?: string[] } | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/test-local-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ollamaUrl, ollamaModel }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult({
          success: true,
          message: data.message || 'Kết nối thành công!',
          models: data.availableModels,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Không thể kết nối đến Local Model Server.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Lỗi kết nối: ${err.message || 'Server offline'}.`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    onSaveConfig({
      engineType,
      ollamaUrl: ollamaUrl.trim(),
      ollamaModel: ollamaModel.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Cấu hình AI Model (Local & Cloud)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Chọn mô hình AI phù hợp cho máy nhẹ (Bronze), chạy local hoặc Cloud Gemini.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Engine Selector */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Chọn Động Cơ Phân Tích AI
            </label>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Option 1: Gemini Cloud */}
              <button
                type="button"
                onClick={() => setEngineType('gemini')}
                className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  engineType === 'gemini'
                    ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="p-2 rounded-lg bg-indigo-500 text-white shrink-0 mt-0.5">
                  <Server className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">
                      Gemini 3.6 Flash (Cloud AI)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                      Mặc định
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Độ chính xác cao nhất. Cần kết nối Internet. Hỗ trợ tóm tắt sâu & trả lời câu hỏi trực tiếp.
                  </p>
                </div>
              </button>

              {/* Option 2: Local LLM Server (Ollama / LM Studio) */}
              <button
                type="button"
                onClick={() => setEngineType('local-ollama')}
                className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  engineType === 'local-ollama'
                    ? 'border-purple-500 bg-purple-50/70 dark:bg-purple-950/40 ring-2 ring-purple-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="p-2 rounded-lg bg-purple-600 text-white shrink-0 mt-0.5">
                  <Terminal className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">
                      Local Model LLM (Ollama / LM Studio)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                      Riêng tư & Không giới hạn
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Chạy trực tiếp trên máy qua Ollama (Llama3, Qwen2.5, Phi3...). Không lo hết quota.
                  </p>
                </div>
              </button>

              {/* Option 3: Local Fast Engine (Offline Light Mode) */}
              <button
                type="button"
                onClick={() => setEngineType('local-fast')}
                className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  engineType === 'local-fast'
                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="p-2 rounded-lg bg-emerald-600 text-white shrink-0 mt-0.5">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">
                      Local Fast Engine (Offline Light Mode - Siêu Nhẹ)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                      Khuyên dùng cho máy Bronze
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Tốc độ xử lý ngay lập tức (&lt;10ms), 0% độ trễ, không tốn RAM/CPU, hoạt động offline 100% không cần tải server nào!
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Additional Settings for Local Ollama */}
          {engineType === 'local-ollama' && (
            <div className="p-4 rounded-xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 space-y-3.5">
              <h4 className="text-xs font-bold text-purple-900 dark:text-purple-200 uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-purple-600" /> Cấu hình Địa chỉ Local Ollama Server
              </h4>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Ollama Server URL
                </label>
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Tên Model Local
                </label>
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  placeholder="llama3.2 hoặc qwen2.5 hoặc phi3"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Mẹo máy nhẹ (Bronze): Khuyên dùng model siêu nhẹ như <code className="bg-purple-100 dark:bg-purple-900/60 px-1 py-0.5 rounded text-purple-800 dark:text-purple-300">qwen2:0.5b</code> hoặc <code className="bg-purple-100 dark:bg-purple-900/60 px-1 py-0.5 rounded text-purple-800 dark:text-purple-300">llama3.2:1b</code>
                </p>
              </div>

              {/* Test Button */}
              <div className="pt-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  <span>Kiểm tra Kết nối Ollama</span>
                </button>
              </div>

              {/* Test Result Message */}
              {testResult && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                    testResult.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                      : 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium">{testResult.message}</p>
                    {testResult.models && testResult.models.length > 0 && (
                      <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                        Models hiện có trên máy: {testResult.models.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fast local engine info box */}
          {engineType === 'local-fast' && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200 space-y-1.5">
              <div className="flex items-center gap-2 font-semibold">
                <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Chế độ Offline Light Mode (Tối ưu cho Máy Bronze/Yếu)</span>
              </div>
              <p className="text-emerald-800 dark:text-emerald-300">
                Chế độ này tự động trích xuất các câu trọng tâm, danh sách công việc (Action items), từ khoá chủ đề và trả lời câu hỏi trực tiếp trên trình duyệt mà không tốn tài nguyên máy hay chờ API.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Áp dụng Cấu hình</span>
          </button>
        </div>
      </div>
    </div>
  );
};
