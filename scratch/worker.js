/**
 * Cloudflare Worker: GitHub Upload Proxy
 * Handles multipart/form-data uploads and commits them to GitHub via Pull Requests.
 * Supports updating existing files by automatically fetching their SHA.
 */

export default {
  async fetch(request, env) {
    // 1. Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    try {
      // 2. Parse FormData
      const formData = await request.formData();
      const file = formData.get("file");
      const targetPath = formData.get("targetPath");
      const branchName = formData.get("branchName");
      const commitMsg = formData.get("commitMsg");
      const prBody = formData.get("prBody");

      if (!file || !targetPath || !branchName || !commitMsg) {
        return new Response(JSON.stringify({ message: "Missing required fields." }), { 
          status: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      const GITHUB_TOKEN = env.GITHUB_TOKEN;
      const GITHUB_REPO = "harshX091/Exam_Papers"; // Update this if your repo name changed

      if (!GITHUB_TOKEN) {
        return new Response(JSON.stringify({ message: "Worker Error: GITHUB_TOKEN is not configured." }), { 
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      const ghHeaders = {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Cloudflare-Worker-Upload-Proxy",
      };

      // 3. Convert File to Base64 (using chunked conversion to avoid stack overflow and CPU timeout)
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binaryString = "";
      const chunkSize = 65536;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        binaryString += String.fromCharCode.apply(
          null,
          uint8Array.subarray(i, i + chunkSize)
        );
      }
      const base64Content = btoa(binaryString);

      // --- GitHub API Flow ---

      // A. Get main branch latest SHA (to branch from)
      const mainRefRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/git/refs/heads/main`, { headers: ghHeaders });
      if (!mainRefRes.ok) throw new Error("Failed to fetch main branch ref.");
      const mainRefData = await mainRefRes.json();
      const mainSha = mainRefData.object.sha;

      // B. Check if file already exists on main (to get SHA for update)
      let existingFileSha = null;
      const fileCheckRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${targetPath}?ref=main`, { headers: ghHeaders });
      if (fileCheckRes.ok) {
        const fileData = await fileCheckRes.json();
        existingFileSha = fileData.sha;
      }

      // C. Create New Branch
      const createBranchRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/git/refs`, {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: mainSha,
        }),
      });
      if (!createBranchRes.ok) {
        const err = await createBranchRes.json();
        throw new Error(`Failed to create branch: ${err.message}`);
      }

      // D. Commit File to New Branch
      const commitPayload = {
        message: commitMsg,
        content: base64Content,
        branch: branchName,
      };
      if (existingFileSha) {
        commitPayload.sha = existingFileSha; // Required for updates!
      }

      const commitRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${targetPath}`, {
        method: "PUT",
        headers: ghHeaders,
        body: JSON.stringify(commitPayload),
      });

      if (!commitRes.ok) {
        const err = await commitRes.json();
        throw new Error(`GitHub File creation failed: ${err.message}`);
      }

      // E. Create Pull Request
      const prRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/pulls`, {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({
          title: commitMsg,
          body: prBody,
          head: branchName,
          base: "main",
        }),
      });

      if (!prRes.ok) {
        const err = await prRes.json();
        throw new Error(`Failed to create PR: ${err.message}`);
      }

      const prData = await prRes.json();

      return new Response(JSON.stringify({ success: true, prUrl: prData.html_url }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });

    } catch (error) {
      return new Response(JSON.stringify({ message: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
  },
};
