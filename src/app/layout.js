import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/lib/firebase/auth";
import "./globals.css";

export const metadata = {
  title: "Project Tales",
  description: "AI Interactive Storytelling",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        <AuthProvider>
          <Navbar />
          <main className="container mx-auto p-4">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
