import "./globals.css";

export const metadata = {
  title: "ChainGuard — Wallet Risk Intelligence",
  description: "Investigate blockchain wallet risk with transparent evidence and source coverage.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
