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
    <nav className="bg-gray-900 text-white p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold tracking-wider text-purple-400 hover:text-purple-300 transition">
          Project Tales
        </Link>
        <div className="space-x-4">
          {user ? (
            <>
              <Link href="/" className="hover:text-gray-300">Dashboard</Link>
              <button 
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm transition"
              >
                Logout
              </button>
            </>
          ) : (
            <Link href="/login" className="bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded text-sm transition">
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
