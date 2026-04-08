import { RegisterForm } from "@/components/forms/RegisterForm";
import { Smartphone } from "lucide-react";

export default function RegisterPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl p-6">
      <div className="mb-6 inline-flex items-center gap-2 text-zinc-700">
        <Smartphone className="h-5 w-5 text-emerald-600" />
        <h1 className="text-xl font-semibold">LIFF Registration</h1>
      </div>
      <RegisterForm />
    </main>
  );
}
