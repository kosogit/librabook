import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Button, Field, navigate } from "./components";
import { useStore } from "./store";
import { api } from "./api";
export async function passwordHash(password, salt) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(salt + password),
  );
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export default function Auth({ mode = "login" }) {
  const { loginDemo, setSession, saveItem, notify, live, reload } = useStore();
  const [accountRole, setAccountRole] = useState("student");
  const [step, setStep] = useState(mode),
    [email, setEmail] = useState(""),
    [name, setName] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reset, setReset] = useState(false),
    [sent, setSent] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (live) {
        const result = await api.auth(step, {
          email,
          name,
          password,
          code,
          role: accountRole,
        });
        if (result?.session) {
          setSession(result.session);
          await reload();
          navigate(
            `/${result.session.role}/${result.session.role === "owner" ? "libraries" : "home"}`,
          );
        } else setStep(result?.next || "otp");
        return;
      }
      const users = JSON.parse(localStorage.getItem("libra-accounts") || "[]");
      if (step === "signup") {
        if (users.some((u) => u.email === email.toLowerCase()))
          throw new Error("An account with this email already exists.");
        setStep("otp");
        notify("Demo verification code: 123456", "info");
      } else if (step === "forgot") {
        setReset(true);
        setStep("otp");
        notify("Demo reset code: 123456. No email is sent.", "info");
      } else if (step === "otp") {
        if (code !== "123456")
          throw new Error("Enter the demo verification code 123456.");
        if (reset) {
          setStep("reset");
          return;
        }
        const salt = crypto.randomUUID(),
          user = {
            id: crypto.randomUUID(),
            name,
            email: email.toLowerCase(),
            salt,
            hash: await passwordHash(password, salt),
            role: "student",
          };
        localStorage.setItem(
          "libra-accounts",
          JSON.stringify([...users, user]),
        );
        await saveItem("members", {
          id: user.id,
          name,
          email,
          membership: "Hourly",
          status: "Active",
        });
        setSession({ id: user.id, name, email, role: "student" });
        navigate("/student/home");
        notify("Welcome to your next chapter.");
      } else if (step === "reset") {
        const u = users.find((u) => u.email === email.toLowerCase());
        if (!u)
          throw new Error(
            "This demo account does not exist. Create an account first.",
          );
        u.salt = crypto.randomUUID();
        u.hash = await passwordHash(password, u.salt);
        localStorage.setItem("libra-accounts", JSON.stringify(users));
        setStep("login");
        setPassword("");
        notify("Your demo password has been reset.");
      } else {
        const u = users.find((u) => u.email === email.toLowerCase());
        if (!u || u.hash !== (await passwordHash(password, u.salt)))
          throw new Error(
            "Email or password is incorrect. Or choose a demo workspace below.",
          );
        setSession({ id: u.id, name: u.name, email: u.email, role: u.role });
        navigate(`/${u.role}/home`);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-story">
        <a href="#/student/home" className="brand">
          <BookOpen />
          <span>
            LibraBook<span className="brand-period">.</span>
          </span>
        </a>
        <div>
          <span className="eyebrow">A LITTLE SPACE. A BIG DIFFERENCE.</span>
          <h1>
            Your next chapter
            <br />
            starts here.
          </h1>
          <p>
            Find your quiet corner. Build your daily ritual.
            <br />
            Make a little room for something great.
          </p>
          <div className="auth-quote">
            “The right space changes everything.”
            <span>FOR THE READERS, DREAMERS & DOERS.</span>
          </div>
        </div>
        <span>Thoughtfully made for a more focused you.</span>
      </section>
      <section className="auth-panel">
        <button className="back-link" onClick={() => navigate("/student/home")}>
          <ArrowLeft size={16} /> Back to explore
        </button>
        <div className="auth-form">
          <span className="round-icon">
            <LockKeyhole />
          </span>
          <h2>
            {
              {
                login: "Welcome back.",
                signup: "Make yourself at home.",
                otp: "Check your inbox.",
                forgot: "A fresh start.",
                reset: "Choose a new password.",
              }[step]
            }
          </h2>
          <p>
            {
              {
                login: "Your favorite study spot is waiting for you.",
                signup: "A quieter space. A brighter future.",
                otp: live
                  ? "Enter the six-digit code sent to your email."
                  : "Demo mode: enter 123456 to continue.",
                forgot: "Enter your registered email to reset your password.",
                reset: "Use at least 8 characters for your new password.",
              }[step]
            }
          </p>
          <form onSubmit={submit}>
            {step === "signup" && live && (
              <Field label="Account type">
                <select
                  value={accountRole}
                  onChange={(e) => setAccountRole(e.target.value)}
                >
                  <option value="student">Customer — book a seat</option>
                  <option value="owner">
                    Library admin — manage my libraries
                  </option>
                </select>
              </Field>
            )}
            {step === "signup" && (
              <Field
                label="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            )}
            {!["otp", "reset"].includes(step) && (
              <Field
                label="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                type="email"
                autoComplete="email"
              />
            )}
            {["login", "signup", "reset"].includes(step) && (
              <Field
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                autoComplete={
                  step === "login" ? "current-password" : "new-password"
                }
              />
            )}
            {step === "otp" && (
              <Field
                label="Verification code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                autoComplete="one-time-code"
              />
            )}
            {step === "login" && !live && (
              <button
                type="button"
                className="link float-right mb-5"
                onClick={() => setStep("forgot")}
              >
                Forgot password?
              </button>
            )}
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <Button className="w-full" disabled={busy}>
              {busy
                ? "One moment…"
                : {
                    login: "Sign in",
                    signup: "Create account",
                    otp: "Verify code",
                    forgot: "Send reset code",
                    reset: "Reset password",
                  }[step]}
              <ArrowRight size={16} />
            </Button>
          </form>
          {step === "otp" && (
            <button
              className="link mt-4"
              disabled={sent}
              onClick={async () => {
                try {
                  if (live) await api.auth("resend", { email });
                  notify(
                    live ? "Verification code sent." : "Demo code: 123456",
                    "info",
                  );
                  setSent(true);
                  setTimeout(() => setSent(false), 30000);
                } catch (e) {
                  notify(e.message, "error");
                }
              }}
            >
              {sent ? "You can resend in 30 seconds" : "Resend code"}
            </button>
          )}
          <p className="auth-toggle">
            {step === "login" ? "New around here?" : "Already have an account?"}{" "}
            <button
              className="link"
              onClick={() => {
                setStep(step === "login" ? "signup" : "login");
                setError("");
              }}
            >
              {step === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
          {!live && (
            <div className="demo-access">
              <span>EXPLORE A DEMO WORKSPACE</span>
              <div>
                {["student", "owner", "receptionist", "admin"].map((role) => (
                  <button key={role} onClick={() => navigate(loginDemo(role))}>
                    {role}
                    <ArrowUp />
                  </button>
                ))}
              </div>
              <small>
                Demo accounts, OTP, and payments run in your browser.
              </small>
            </div>
          )}
        </div>
        <div className="auth-secure">
          <ShieldCheck size={14} /> Your space to learn. Your room to grow.
        </div>
      </section>
    </div>
  );
}
function ArrowUp() {
  return <ArrowRight size={13} />;
}
