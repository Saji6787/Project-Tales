"use client";
import { useState } from "react";
import { useAuth } from "@/lib/firebase/auth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const { login, register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (isRegister) {
        await register(email, password);
      } else {
        await login(email, password);
      }
      router.push("/");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-2xl border border-gray-100/50">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-[#0A0A0A] tracking-tight">
            {isRegister ? "Join Project Tales" : "Welcome"}
          </h2>
          <p className="text-gray-400 mt-2 text-sm font-medium">
            {isRegister ? "Start your journey into the unknown." : "Continue your immersive interactive story."}
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-500 text-sm p-3 rounded-xl mb-6 border border-red-100 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-[#0A0A0A] mb-1.5 ml-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF7B00]/20 focus:border-[#FF7B00] outline-none transition-all bg-gray-50 focus:bg-white text-gray-800 placeholder-gray-400"
              placeholder="name@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-[#0A0A0A] mb-1.5 ml-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF7B00]/20 focus:border-[#FF7B00] outline-none transition-all bg-gray-50 focus:bg-white text-gray-800 placeholder-gray-400"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-[#FF7B00] text-gray-50 py-4 rounded-xl font-bold text-lg hover:bg-[#e06c00] transition shadow-lg hover:shadow-xl active:scale-[0.98] transform duration-200 cursor-pointer"
          >
            {isRegister ? "Create Account" : "Sign In"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm">
            {isRegister ? "Already have an account?" : "No account yet?"}{" "}
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="text-[#FF7B00] font-bold hover:underline hover:text-[#e06c00] transition cursor-pointer"
            >
              {isRegister ? "Sign In" : "Register Now"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
