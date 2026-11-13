import Dashboard from "../../components/dashboard";
import AuthGate from "../../components/auth-gate";

export default function DashboardPage() {
  return <AuthGate><Dashboard /></AuthGate>;
}
