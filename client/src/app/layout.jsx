import "./globals.css";
import { connection } from "next/server";

export const metadata = {
  title: "ChainGuard — Wallet Risk Intelligence",
  description: "Investigate blockchain wallet risk with transparent evidence and source coverage.",
  icons: { icon: "/icon.svg", shortcut: "/icon.svg" },
};

export default async function RootLayout({ children }) {
  await connection();
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
