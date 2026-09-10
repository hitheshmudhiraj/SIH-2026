import React from "react";
import Auth5 from "./ui/auth-5";

const DEMO_USERS = [
  { username: "admin",   password: "railblock@2026", role: "Senior Planning Officer",  zone: "Central Railway" },
  { username: "planner", password: "planner123",     role: "Block Planning Engineer",  zone: "Western Railway" },
  { username: "demo",    password: "demo",            role: "Demo User",               zone: "Indian Railways" },
];

export default function LoginPage({ onLogin }) {
  return (
    <div className="relative w-screen h-screen overflow-hidden font-sans bg-slate-900 select-none">
      {/* Full Background Indian Railways Locomotive & Track Maintenance Image */}
      <img
        src="/login_bg.jpg"
        alt="Indian Railways Locomotive and Track Maintenance"
        className="absolute inset-0 w-full h-full object-cover object-left md:object-center pointer-events-none"
      />

      {/* Floating Glassmorphic Authentication Card on the Right */}
      <div className="relative z-10 w-full h-full flex items-center justify-center sm:justify-end px-5 sm:px-12 lg:px-20 xl:px-28">
        <Auth5
          onLogin={onLogin}
          demoUsers={DEMO_USERS}
        />
      </div>
    </div>
  );
}