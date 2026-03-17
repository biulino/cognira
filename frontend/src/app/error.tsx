"use client";

import * as React from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Log to console in development; Sentry/similar can be wired here
    console.error("[app error boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-2xl font-semibold text-gray-800">Algo correu mal</h2>
      <p className="max-w-sm text-gray-500">
        Ocorreu um erro inesperado. Se o problema persistir, contacte o suporte.
      </p>
      {error.digest && (
        <p className="text-xs text-gray-400">Referência: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Tentar novamente
      </button>
    </div>
  );
}
