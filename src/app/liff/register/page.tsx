import { RegisterForm } from "@/components/forms/RegisterForm";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-4 sm:p-6">
      <div className="w-full max-w-3xl">
        <RegisterForm />
      </div>
    </main>
  );
}
