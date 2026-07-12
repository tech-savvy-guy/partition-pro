import React from 'react'

export function NoColorsIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-gray-400"
        >
            <circle cx="12" cy="12" r="1" />
            <path d="M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
    )
}
