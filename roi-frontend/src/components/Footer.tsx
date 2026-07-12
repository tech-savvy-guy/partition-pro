export default function Footer() {
  return (
    <footer
      className="
        bg-white/95 backdrop-blur-md
        border-t-2 border-[#C41230]
        shadow-[0_-1px_4px_rgba(0,0,0,0.06)]
        text-center text-xs text-gray-700
        py-3
        tracking-wide
      "
    >
      © {new Date().getFullYear()} Bain. All rights reserved.
    </footer>
  );
}
