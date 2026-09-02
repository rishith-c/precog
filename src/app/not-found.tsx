import Link from "next/link";
import Rail from "@/components/Rail";

export default function NotFound() {
  return (
    <>
      <Rail />
      <main className="auth">
        <div className="auth-in">
          <h1>Nothing here.</h1>
          <p className="sub">That address does not point at a page, a run, or a report.</p>
          <p className="alt">
            <Link href="/">Run a page</Link> · <Link href="/method">Read the method</Link>
          </p>
        </div>
      </main>
    </>
  );
}
