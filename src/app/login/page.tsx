import { LoginForm } from "./login-form";

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  const urlError =
    error === "unauthorized"
      ? "Access denied. Admin privileges required."
      : undefined;

  return <LoginForm urlError={urlError} />;
}
