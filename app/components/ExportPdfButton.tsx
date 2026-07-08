"use client";

import { useState } from "react";

export function ExportMenu({ excelHref }: { excelHref: string }) {
  const [open, setOpen] = useState(false);

  function exportPdf(mode: "tab" | "complete") {
    setOpen(false);
    document.body.dataset.printMode = mode;
    window.print();
    window.setTimeout(() => {
      delete document.body.dataset.printMode;
    }, 500);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="secondary-button h-9 rounded-md px-3 py-0 text-xs font-bold leading-5"
        aria-expanded={open}
      >
        Export
      </button>
      {open ? (
        <div className="absolute left-0 z-30 mt-2 grid w-44 overflow-hidden rounded-md border border-slate-200 bg-white p-1 text-xs font-bold shadow-lg">
          <button type="button" onClick={() => exportPdf("tab")} className="rounded px-3 py-2 text-left text-slate-700 hover:bg-slate-50">
            PDF current tab
          </button>
          <button type="button" onClick={() => exportPdf("complete")} className="rounded px-3 py-2 text-left text-slate-700 hover:bg-slate-50">
            PDF all tabs
          </button>
          <a href={excelHref} onClick={() => setOpen(false)} className="rounded px-3 py-2 text-slate-700 hover:bg-slate-50">
            Excel workbook
          </a>
        </div>
      ) : null}
    </div>
  );
}
