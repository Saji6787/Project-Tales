"use client";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/auth";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/login"); // Redirect to login after logout
  };

  return (
    <nav className="sticky top-0 z-50 bg-[#FCF5EF] text-[#0A0A0A] shadow-sm border-b border-[#0A0A0A]/5">
      <div className="container mx-auto p-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-extrabold tracking-wider text-[#FF7B00] hover:text-[#d96900] transition">
          Project Tales
        </Link>
        <div className="space-x-4">
          {user ? (
            <>
              <Link href="/" className="hover:text-gray-600 font-medium">Dashboard</Link>
              <button 
                onClick={handleLogout}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-600 px-3 py-1 rounded-lg text-sm transition font-medium"
              >
                Logout
              </button>
            </>
          ) : (
            <Link href="/login" className="bg-black text-[#FF7B00] hover:bg-gray-900 px-4 py-1.5 rounded-full text-sm transition font-bold shadow-sm">
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
