import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export const maxDuration = 120; // 2 min — AI enrichment via Perplexity Sonar can be slow

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const username = (body.username ?? "").trim();

  if (!username) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  const scriptPath = path.join(process.cwd(), "twibbonize_profile_scraper.py");

  // Use venv Python (has openai installed); fall back to system python3
  const venvPython = path.join(process.cwd(), ".venv", "bin", "python");
  const pythonBin = require("fs").existsSync(venvPython) ? venvPython : "python3";

  // Run with --enrich if OpenRouter key is available (fills segment, summary, country, etc.)
  const args = [scriptPath, username];
  if (process.env.OPENROUTER_API_KEY) args.push("--enrich");

  return new Promise<NextResponse>((resolve) => {
    let stdout = "";
    let stderr = "";

    const proc = spawn(pythonBin, args, {
      env: { ...process.env },
      cwd: process.cwd(),
    });

    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

    proc.on("error", (err) => {
      resolve(NextResponse.json({ error: err.message }, { status: 500 }));
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        resolve(
          NextResponse.json(
            { error: stderr || `Script exited with code ${code}` },
            { status: 500 }
          )
        );
        return;
      }
      try {
        const result = JSON.parse(stdout);
        resolve(NextResponse.json(result));
      } catch {
        resolve(
          NextResponse.json(
            { error: "Failed to parse script output", raw: stdout.slice(0, 500) },
            { status: 500 }
          )
        );
      }
    });
  });
}
