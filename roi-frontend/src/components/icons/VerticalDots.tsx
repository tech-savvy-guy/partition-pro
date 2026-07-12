import React from 'react'
export default function VericalDots(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" {...props}>
      <rect x="7" y="3"  width="2" height="2" rx="1" />
      <rect x="7" y="7"  width="2" height="2" rx="1" />
      <rect x="7" y="11" width="2" height="2" rx="1" />
    </svg>
  )
}