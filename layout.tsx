import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Duo Lobby — your private corner",
  description: "A private, two-player chat lobby for you and your friend."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
