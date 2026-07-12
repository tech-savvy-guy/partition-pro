import React from 'react'
import ArrowRightIcon from './icons/arrow-right';

export default function ActionCard({
  title, description, icon, onClick,
}: { title: string; description: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group h-full rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm outline-none transition
                 hover:-translate-y-0.5 hover:shadow-md focus:translate-y-0 focus:shadow-md focus:ring-2 focus:ring-red-600"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-red-50 text-red-600">{icon}</div>
        <div>
          <div className="text-base font-semibold text-gray-800">{title}</div>
          <div className="text-xs text-gray-500">{description}</div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm font-medium text-red-600 opacity-0 transition group-hover:opacity-100">
        Continue
        <ArrowRightIcon className="h-4 w-4" />
      </div>
    </button>
  )
}
