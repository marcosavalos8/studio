import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M7 7h10v10H7z" />
      <path d="M3 7v10" />
      <path d="M21 7v10" />
      <path d="M12 3v4" />
      <path d="M12 17v4" />
      <path d="M7 3h10" />
      <path d="M7 21h10" />
    </svg>
  );
}
