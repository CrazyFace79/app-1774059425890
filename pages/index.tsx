import { useEffect } from "react";
import { useRouter } from "next/router";
import { getUser } from "../lib/storage";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const user = getUser();
    router.replace(user ? "/tasks" : "/login");
  }, [router]);

  return (
    <div className="auth-page">
      <p style={{ color: "var(--text-muted)" }}>Cargando...</p>
    </div>
  );
}
