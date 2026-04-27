"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type TabType = "login" | "register";

const ACCESS_ERRORS: Record<string, string> = {
  access_revoked: "Access denied — contact the administrator or sign in with an authorized account.",
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 读取 URL error 参数
  useEffect(() => {
    const code = searchParams.get("error");
    if (code && ACCESS_ERRORS[code]) {
      setError(ACCESS_ERRORS[code]);
    }
  }, [searchParams]);

  // ── Login ──────────────────────────────────────────────────────────────────

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    setLoading(true);
    try {
      const supabase = createClient();

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) { setError(signInError.message); setLoading(false); return; }

      // Allowlist check — email must exist in otb_member with granted = true
      const { data: member } = await supabase
        .from("otb_member")
        .select("email, granted")
        .eq("email", email)
        .maybeSingle();

      if (!member || !member.granted) {
        await supabase.auth.signOut();
        setError("Access denied — contact the administrator or sign in with an authorized account.");
        setLoading(false);
        return;
      }

      // 成功：保持 loading=true 直到页面跳转，避免按钮短暂恢复高亮
      router.push("/");
      router.refresh();
    } catch {
      setError("Sign in failed. Please try again.");
      setLoading(false);
    }
  };

  // ── Register ───────────────────────────────────────────────────────────────

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const confirm = (form.elements.namedItem("confirmPassword") as HTMLInputElement).value;

    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      if (data.session) {
        // 成功：保持 loading=true 直到页面跳转
        router.push("/");
        router.refresh();
      } else {
        setSuccess("Account created. Please check your email to verify, then sign in.");
        setActiveTab("login");
        setLoading(false);
      }
    } catch {
      setError("Registration failed. Please try again.");
      setLoading(false);
    }
  };

  const switchTab = (tab: TabType) => {
    if (loading) return;
    setActiveTab(tab);
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      {/* Subtle background texture */}
      <div className="absolute inset-0 bg-[#F9F8F6]" />

      <div className="relative w-full max-w-sm">
        {/* Brand header */}
        <div className="text-center mb-12">
          <p className="text-[10px] text-gray-400 uppercase tracking-[0.3em] font-semibold mb-3">
            Jimmy Choo
          </p>
          <h1 className="text-2xl font-light text-[#1A1A1A] tracking-[0.2em] uppercase">
            OTB Intelligence
          </h1>
          <div className="w-8 h-[1px] bg-[#C5973F] mx-auto mt-4" />
        </div>

        {/* Card */}
        <div className="bg-white border border-[#E8E4DF] p-8">
          {/* Tabs */}
          <div className="flex mb-8 border-b border-[#E8E4DF]">
            {(["login", "register"] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => switchTab(tab)}
                disabled={loading}
                className={`flex-1 pb-3 text-[11px] uppercase tracking-[0.2em] font-semibold transition-colors relative ${
                  activeTab === tab
                    ? "text-[#1A1A1A] after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-[#C5973F]"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {tab === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          {/* Feedback messages */}
          {error && (
            <p className="mb-5 text-[11px] text-red-500 uppercase tracking-wider border border-red-200 px-3 py-2 bg-red-50">
              {error}
            </p>
          )}
          {success && (
            <p className="mb-5 text-[11px] text-[#C5973F] uppercase tracking-wider border border-[#EFE0C0] px-3 py-2 bg-[#EFE0C0]/30">
              {success}
            </p>
          )}

          {/* Forms — fixed height to keep card size consistent across tabs */}
          <div className="min-h-[17rem]">
          {/* Login form */}
          {activeTab === "login" && (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] uppercase tracking-[0.2em] text-gray-400 font-semibold">
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  disabled={loading}
                  placeholder="your@email.com"
                  className="border border-[#E8E4DF] px-3 py-2.5 text-sm text-[#1A1A1A] placeholder-gray-300 outline-none focus:border-[#1A1A1A] transition-colors disabled:opacity-50 bg-white"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] uppercase tracking-[0.2em] text-gray-400 font-semibold">
                  Password
                </label>
                <input
                  name="password"
                  type="password"
                  required
                  disabled={loading}
                  placeholder="••••••••"
                  className="border border-[#E8E4DF] px-3 py-2.5 text-sm text-[#1A1A1A] placeholder-gray-300 outline-none focus:border-[#1A1A1A] transition-colors disabled:opacity-50 bg-white"
                />
              </div>

              <div className="flex items-center justify-between mt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    name="remember"
                    type="checkbox"
                    className="accent-[#C5973F] w-3 h-3"
                  />
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Remember me</span>
                </label>
                <button
                  type="button"
                  className="text-[10px] text-gray-400 uppercase tracking-wider hover:text-[#C5973F] transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-3 w-full bg-[#1A1A1A] text-white py-3 text-[11px] uppercase tracking-[0.25em] font-semibold hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          )}

          {/* Register form */}
          {activeTab === "register" && (
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] uppercase tracking-[0.2em] text-gray-400 font-semibold">
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  disabled={loading}
                  placeholder="your@email.com"
                  className="border border-[#E8E4DF] px-3 py-2.5 text-sm text-[#1A1A1A] placeholder-gray-300 outline-none focus:border-[#1A1A1A] transition-colors disabled:opacity-50 bg-white"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] uppercase tracking-[0.2em] text-gray-400 font-semibold">
                  Password
                </label>
                <input
                  name="password"
                  type="password"
                  required
                  disabled={loading}
                  placeholder="Min. 6 characters"
                  className="border border-[#E8E4DF] px-3 py-2.5 text-sm text-[#1A1A1A] placeholder-gray-300 outline-none focus:border-[#1A1A1A] transition-colors disabled:opacity-50 bg-white"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] uppercase tracking-[0.2em] text-gray-400 font-semibold">
                  Confirm Password
                </label>
                <input
                  name="confirmPassword"
                  type="password"
                  required
                  disabled={loading}
                  placeholder="Re-enter password"
                  className="border border-[#E8E4DF] px-3 py-2.5 text-sm text-[#1A1A1A] placeholder-gray-300 outline-none focus:border-[#1A1A1A] transition-colors disabled:opacity-50 bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-3 w-full bg-[#1A1A1A] text-white py-3 text-[11px] uppercase tracking-[0.25em] font-semibold hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating account..." : "Create Account"}
              </button>
            </form>
          )}
          </div>{/* end fixed-height wrapper */}
        </div>

        {/* Footer */}
        <p className="text-center text-[9px] text-gray-300 uppercase tracking-widest mt-8">
          Internal Use Only · Jimmy Choo OTB
        </p>
      </div>
    </div>
  );
}
