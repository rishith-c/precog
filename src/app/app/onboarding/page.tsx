import Form from "@/components/Form";
import { setGoal } from "@/app/actions";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Set up — Precog" };

/* One question, asked after signup rather than during it, because it costs
   a field on the form that decides whether someone signs up at all — and
   it is only useful once they are inside. */
const GOALS = [
  "Rank variants of one landing page before I A/B test",
  "Check every page before it ships",
  "Audit pages I already have live",
  "Compare my page against a competitor's",
];

export default async function Onboarding() {
  const user = await requireUser();
  return (
    <main className="auth">
      <div className="auth-in">
        <h1>One question, {user.name}.</h1>
        <p className="sub">It sets what the overview leads with. You can change it later in settings.</p>
        <Form action={setGoal} submit="Continue" pendingLabel="Saving">
          <label className="field">
            <span>What are you here to do?</span>
            <select name="goal" defaultValue={GOALS[0]}>
              {GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
        </Form>
      </div>
    </main>
  );
}
