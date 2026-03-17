"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, CameraOff, Keyboard, Copy, Check, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export interface BarcodeResult {
  rawValue: string;
  format: string;
  detectedAt: string;
}

interface BarcodeScannerProps {
  onDetect?: (result: BarcodeResult) => void;
  /** If true, show the scan history list below the camera */
  showHistory?: boolean;
  className?: string;
}

// Check native BarcodeDetector support
const isBarcodeDetectorSupported =
  typeof window !== "undefined" &&
  "BarcodeDetector" in window;

const SUPPORTED_FORMATS = [
  "ean_13", "ean_8", "upc_a", "upc_e",
  "code_39", "code_128", "qr_code", "data_matrix",
  "itf", "codabar", "aztec", "pdf417",
];

export default function BarcodeScanner({
  onDetect,
  showHistory = true,
  className = "",
}: BarcodeScannerProps) {
  const { t } = useI18n();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detectorRef = useRef<any>(null);

  const [mode, setMode] = useState<"camera" | "manual">(
    isBarcodeDetectorSupported ? "camera" : "manual"
  );
  const [cameraError, setCameraError] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [history, setHistory] = useState<BarcodeResult[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [lastDetected, setLastDetected] = useState<string | null>(null);

  // Initialise BarcodeDetector
  useEffect(() => {
    if (!isBarcodeDetectorSupported) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      detectorRef.current = new (window as any).BarcodeDetector({
        formats: SUPPORTED_FORMATS,
      });
    } catch {
      setCameraError("BarcodeDetector initialisation failed");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  const handleDetected = useCallback((rawValue: string, format = "unknown") => {
    if (rawValue === lastDetected) return; // debounce duplicates
    setLastDetected(rawValue);
    setTimeout(() => setLastDetected(null), 2000);

    const result: BarcodeResult = {
      rawValue,
      format,
      detectedAt: new Date().toLocaleTimeString(),
    };
    setHistory(h => [result, ...h.slice(0, 49)]);
    onDetect?.(result);
  }, [lastDetected, onDetect]);

  const startCamera = useCallback(async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);

        // Frame-by-frame detection loop
        const detect = async () => {
          if (!videoRef.current || !canvasRef.current || !detectorRef.current) return;
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (video.readyState !== video.HAVE_ENOUGH_DATA) {
            animRef.current = requestAnimationFrame(detect);
            return;
          }
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(video, 0, 0);

          try {
            const barcodes = await detectorRef.current.detect(canvas);
            if (barcodes.length > 0) {
              handleDetected(barcodes[0].rawValue, barcodes[0].format);
            }
          } catch { /* detection frame error — ignore */ }

          animRef.current = requestAnimationFrame(detect);
        };
        detect();
      }
    } catch (err: unknown) {
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? t("barcode.permDenied")
          : t("barcode.cameraError", { error: err instanceof Error ? err.message : String(err) });
      setCameraError(msg);
    }
  }, [t, handleDetected]);

  useEffect(() => {
    if (mode === "camera" && isBarcodeDetectorSupported) {
      startCamera();
    }
    return () => stopCamera();
  }, [mode, startCamera, stopCamera]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = manualValue.trim();
    if (!v) return;
    handleDetected(v, "manual");
    setManualValue("");
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 1500);
    });
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Mode tabs */}
      <div className="flex gap-2">
        {isBarcodeDetectorSupported && (
          <button
            onClick={() => setMode("camera")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              mode === "camera"
                ? "bg-[#2D6BEE] text-white shadow"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            <Camera className="w-4 h-4" />
            {t("barcode.scanning")}
          </button>
        )}
        <button
          onClick={() => setMode("manual")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            mode === "manual"
              ? "bg-[#2D6BEE] text-white shadow"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          <Keyboard className="w-4 h-4" />
          {t("barcode.manual")}
        </button>
      </div>

      {/* Camera view */}
      {mode === "camera" && (
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3] max-h-72">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {/* Canvas used only for frame capture — hidden */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Scanning overlay */}
          {scanning && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-32 border-2 border-[#2D6BEE] rounded-lg opacity-80">
                <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-[#2D6BEE] rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-[#2D6BEE] rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-[#2D6BEE] rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-[#2D6BEE] rounded-br-lg" />
              </div>
            </div>
          )}

          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 p-4 text-center">
              <CameraOff className="w-10 h-10 text-red-400 mb-2" />
              <p className="text-white text-sm">{cameraError}</p>
            </div>
          )}
        </div>
      )}

      {/* Not supported notice */}
      {mode === "camera" && !isBarcodeDetectorSupported && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          {t("barcode.notSupported")}
        </div>
      )}

      {/* Manual input */}
      {mode === "manual" && (
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={manualValue}
            onChange={e => setManualValue(e.target.value)}
            placeholder={t("barcode.placeholder")}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700
                       dark:bg-slate-800 dark:text-white text-sm focus:outline-none
                       focus:ring-2 focus:ring-[#2D6BEE]/40 focus:border-[#2D6BEE]"
          />
          <button
            type="submit"
            disabled={!manualValue.trim()}
            className="px-5 py-2.5 rounded-xl bg-[#2D6BEE] text-white text-sm font-medium
                       disabled:opacity-40 hover:bg-[#1A52CC] transition"
          >
            {t("barcode.lookup")}
          </button>
        </form>
      )}

      <p className="text-[11px] text-slate-400">{t("barcode.formats")}</p>

      {/* History */}
      {showHistory && history.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t("barcode.history")}
            </p>
            <button
              onClick={() => setHistory([])}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition"
            >
              <Trash2 className="w-3 h-3" />
              {t("barcode.clearHistory")}
            </button>
          </div>

          <ul className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {history.map((item, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between gap-2
                           bg-white dark:bg-slate-800 rounded-xl px-3 py-2
                           border border-slate-100 dark:border-slate-700 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="text-sm font-mono font-semibold truncate text-slate-800 dark:text-slate-100">
                    {item.rawValue}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {item.format} · {item.detectedAt}
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard(item.rawValue)}
                  title={t("barcode.copy")}
                  className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-[#2D6BEE]
                             hover:bg-orange-50 transition"
                >
                  {copiedCode === item.rawValue
                    ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                    : <Copy className="w-3.5 h-3.5" />
                  }
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
