import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Naxium — Data workspace",
  description: "Ask questions of your spreadsheets. Check answers, keep your work and repeat useful calculations.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-AU" data-theme="light" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html: `(function(){try{var t=localStorage.getItem('nx-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t;}catch(e){}})();`}} /></head><body>{children}</body></html>;
}
