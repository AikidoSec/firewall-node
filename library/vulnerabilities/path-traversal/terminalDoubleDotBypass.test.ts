import * as t from "tap";
import { checkContextForPathTraversal } from "./checkContextForPathTraversal";
import { detectPathTraversal } from "./detectPathTraversal";
import { containsUnsafePathParts } from "./containsUnsafePathParts";
import { extractPathStringsFromUserInputCached } from "../../helpers/extractPathStringsFromUserInputCached";
import { Context, runWithContext } from "../../agent/Context";

/**
 * Integration tests for the terminal ".." segments bypass vulnerability.
 * 
 * Pentest finding: Terminal `..` segments bypass path-traversal blocking
 * 
 * The vulnerability occurred because:
 * 1. `containsUnsafePathParts` only matched `../` and `..\\`, missing terminal `..`
 * 2. `extractPathStringsFromUserInputCached` dropped bare `..` (no separator)
 * 3. This allowed `path.resolve(trustedRoot, userInput)` with `..` to escape the root
 * 
 * The fix:
 * 1. `containsUnsafePathParts` now splits on separators and checks for `..` segments
 * 2. `extractPathStringsFromUserInputCached` now keeps bare `..` as an exception
 */

t.test("Terminal double-dot bypass - containsUnsafePathParts", async (t) => {
  t.test("detects bare '..' input", async () => {
    t.same(
      containsUnsafePathParts(".."),
      true,
      "bare '..' must be detected"
    );
  });

  t.test("detects terminal '..' in Unix paths", async () => {
    t.same(
      containsUnsafePathParts("/srv/uploads/.."),
      true,
      "terminal '..' in Unix path must be detected"
    );
    t.same(
      containsUnsafePathParts("/trusted/root/.."),
      true,
      "terminal '..' in trusted root path must be detected"
    );
    t.same(
      containsUnsafePathParts("/var/www/html/.."),
      true,
      "terminal '..' in web root must be detected"
    );
  });

  t.test("detects terminal '..' in Windows paths", async () => {
    t.same(
      containsUnsafePathParts("C:\\uploads\\.."),
      true,
      "terminal '..' in Windows path must be detected"
    );
    t.same(
      containsUnsafePathParts("D:\\data\\files\\.."),
      true,
      "terminal '..' in Windows data path must be detected"
    );
  });

  t.test("detects '..' as a complete segment in middle of path", async () => {
    t.same(
      containsUnsafePathParts("/path/../file"),
      true,
      "'..' in middle of path must be detected"
    );
    t.same(
      containsUnsafePathParts("/a/b/../c"),
      true,
      "'..' between segments must be detected"
    );
  });

  t.test("does not flag safe paths without '..'", async () => {
    t.same(
      containsUnsafePathParts("/srv/uploads/file.txt"),
      false,
      "safe Unix path should not be flagged"
    );
    t.same(
      containsUnsafePathParts("C:\\uploads\\file.txt"),
      false,
      "safe Windows path should not be flagged"
    );
    t.same(
      containsUnsafePathParts("file.txt"),
      false,
      "relative safe path should not be flagged"
    );
  });
});

t.test("Terminal double-dot bypass - detectPathTraversal", async (t) => {
  t.test("detects bare '..' as user input", async () => {
    t.same(
      detectPathTraversal("..", ".."),
      true,
      "bare '..' as both file path and user input must be detected"
    );
  });

  t.test("detects terminal '..' when user input is '..'", async () => {
    // Simulates: path.resolve("/srv/uploads", "..") => "/srv"
    t.same(
      detectPathTraversal("/srv/uploads/..", ".."),
      true,
      "terminal '..' with bare '..' user input must be detected"
    );
    
    // Simulates: path.resolve("/trusted/root", "..") => "/trusted"
    t.same(
      detectPathTraversal("/trusted/root/..", ".."),
      true,
      "trusted root escape with '..' must be detected"
    );
  });

  t.test("detects terminal '..' when user input contains full path", async () => {
    t.same(
      detectPathTraversal("/trusted/root/..", "/trusted/root/.."),
      true,
      "terminal '..' with full path user input must be detected"
    );
    t.same(
      detectPathTraversal("/path/to/file/..", "/path/to/file/.."),
      true,
      "terminal '..' in nested path must be detected"
    );
  });

  t.test("detects '..' in resolved paths", async () => {
    // Node's path.resolve semantics: resolve("/srv/uploads", "..") => "/srv"
    // The detector should catch this before resolution
    t.same(
      detectPathTraversal("/srv", ".."),
      true,
      "parent directory traversal must be detected"
    );
  });

  t.test("does not flag safe paths", async () => {
    t.same(
      detectPathTraversal("/srv/uploads/file.txt", "file.txt"),
      false,
      "safe file access should not be flagged"
    );
    t.same(
      detectPathTraversal("/srv/uploads/subdir/file.txt", "subdir/file.txt"),
      false,
      "safe subdirectory access should not be flagged"
    );
  });
});

t.test("Terminal double-dot bypass - extractPathStringsFromUserInputCached", async (t) => {
  t.test("extracts bare '..' from user input", async () => {
    const context: Context = {
      remoteAddress: "1.2.3.4",
      method: "POST",
      url: "/upload",
      query: {},
      headers: {},
      body: { filename: ".." },
      cookies: {},
      routeParams: {},
      source: "express",
      route: "/upload",
    };

    runWithContext(context, () => {
      const extracted = extractPathStringsFromUserInputCached(context);
      t.same(
        extracted.has(".."),
        true,
        "bare '..' from body must be extracted"
      );
    });
  });

  t.test("extracts '..' from query parameters", async () => {
    const context: Context = {
      remoteAddress: "1.2.3.4",
      method: "GET",
      url: "/file?path=..",
      query: { path: ".." },
      headers: {},
      body: undefined,
      cookies: {},
      routeParams: {},
      source: "express",
      route: "/file",
    };

    runWithContext(context, () => {
      const extracted = extractPathStringsFromUserInputCached(context);
      t.same(
        extracted.has(".."),
        true,
        "bare '..' from query must be extracted"
      );
    });
  });

  t.test("extracts '..' from route parameters", async () => {
    const context: Context = {
      remoteAddress: "1.2.3.4",
      method: "GET",
      url: "/file/..",
      query: {},
      headers: {},
      body: undefined,
      cookies: {},
      routeParams: { path: ".." },
      source: "express",
      route: "/file/:path",
    };

    runWithContext(context, () => {
      const extracted = extractPathStringsFromUserInputCached(context);
      t.same(
        extracted.has(".."),
        true,
        "bare '..' from route params must be extracted"
      );
    });
  });

  t.test("extracts paths with terminal '..'", async () => {
    const context: Context = {
      remoteAddress: "1.2.3.4",
      method: "POST",
      url: "/upload",
      query: {},
      headers: {},
      body: { path: "/trusted/root/.." },
      cookies: {},
      routeParams: {},
      source: "express",
      route: "/upload",
    };

    runWithContext(context, () => {
      const extracted = extractPathStringsFromUserInputCached(context);
      t.same(
        extracted.has("/trusted/root/.."),
        true,
        "path with terminal '..' must be extracted"
      );
    });
  });
});

t.test("Terminal double-dot bypass - checkContextForPathTraversal integration", async (t) => {
  t.test("blocks bare '..' in path operations", async () => {
    const context: Context = {
      remoteAddress: "1.2.3.4",
      method: "GET",
      url: "/file?name=..",
      query: { name: ".." },
      headers: {},
      body: undefined,
      cookies: {},
      routeParams: {},
      source: "express",
      route: "/file",
    };

    runWithContext(context, () => {
      // Simulates: path.resolve("/srv/uploads", userInput)
      const result = checkContextForPathTraversal({
        filename: "/srv/uploads/..",
        operation: "path.resolve",
        context: context,
      }) as { kind: string; operation: string; source: string; payload: string } | undefined;

      t.ok(result, "path traversal must be detected");
      t.same(result?.kind, "path_traversal", "must be path_traversal kind");
      t.same(result?.operation, "path.resolve", "must identify operation");
      t.same(result?.source, "query", "must identify source as query");
      t.same(result?.payload, "..", "must identify '..' as payload");
    });
  });

  t.test("blocks terminal '..' from route parameters", async () => {
    const context: Context = {
      remoteAddress: "1.2.3.4",
      method: "GET",
      url: "/files/..",
      query: {},
      headers: {},
      body: undefined,
      cookies: {},
      routeParams: { path: ".." },
      source: "express",
      route: "/files/:path",
    };

    runWithContext(context, () => {
      const result = checkContextForPathTraversal({
        filename: "/trusted/root/..",
        operation: "fs.readFile",
        context: context,
      }) as { kind: string; operation: string; source: string; payload: string } | undefined;

      t.ok(result, "path traversal must be detected");
      t.same(result?.kind, "path_traversal", "must be path_traversal kind");
      t.same(result?.operation, "fs.readFile", "must identify operation");
      t.same(result?.source, "routeParams", "must identify source as routeParams");
      t.same(result?.payload, "..", "must identify '..' as payload");
    });
  });

  t.test("blocks terminal '..' in POST body", async () => {
    const context: Context = {
      remoteAddress: "1.2.3.4",
      method: "POST",
      url: "/upload",
      query: {},
      headers: {},
      body: { filepath: "/var/www/.." },
      cookies: {},
      routeParams: {},
      source: "express",
      route: "/upload",
    };

    runWithContext(context, () => {
      const result = checkContextForPathTraversal({
        filename: "/var/www/..",
        operation: "fs.writeFile",
        context: context,
      }) as { kind: string; operation: string; source: string; payload: string } | undefined;

      t.ok(result, "path traversal must be detected");
      t.same(result?.kind, "path_traversal", "must be path_traversal kind");
      t.same(result?.operation, "fs.writeFile", "must identify operation");
      t.same(result?.source, "body", "must identify source as body");
      t.same(result?.payload, "/var/www/..", "must identify full path as payload");
    });
  });

  t.test("allows safe file operations", async () => {
    const context: Context = {
      remoteAddress: "1.2.3.4",
      method: "GET",
      url: "/file?name=document.txt",
      query: { name: "document.txt" },
      headers: {},
      body: undefined,
      cookies: {},
      routeParams: {},
      source: "express",
      route: "/file",
    };

    runWithContext(context, () => {
      const result = checkContextForPathTraversal({
        filename: "/srv/uploads/document.txt",
        operation: "fs.readFile",
        context: context,
      });

      t.notOk(result, "safe file access should not be blocked");
    });
  });

  t.test("allows safe subdirectory access", async () => {
    const context: Context = {
      remoteAddress: "1.2.3.4",
      method: "GET",
      url: "/file?path=subdir/file.txt",
      query: { path: "subdir/file.txt" },
      headers: {},
      body: undefined,
      cookies: {},
      routeParams: {},
      source: "express",
      route: "/file",
    };

    runWithContext(context, () => {
      const result = checkContextForPathTraversal({
        filename: "/srv/uploads/subdir/file.txt",
        operation: "fs.readFile",
        context: context,
      });

      t.notOk(result, "safe subdirectory access should not be blocked");
    });
  });
});

t.test("Terminal double-dot bypass - real-world attack scenarios", async (t) => {
  t.test("scenario: file upload with '..' to escape upload directory", async () => {
    // Attacker sends: POST /upload with body: { filename: ".." }
    // Application does: path.resolve("/srv/uploads", req.body.filename)
    // Without fix: resolves to "/srv" (parent directory)
    // With fix: detected and blocked
    
    const context: Context = {
      remoteAddress: "192.168.1.100",
      method: "POST",
      url: "/upload",
      query: {},
      headers: { "content-type": "application/json" },
      body: { filename: ".." },
      cookies: {},
      routeParams: {},
      source: "express",
      route: "/upload",
    };

    runWithContext(context, () => {
      const result = checkContextForPathTraversal({
        filename: "..",
        operation: "path.resolve",
        context: context,
      }) as { payload: string } | undefined;

      t.ok(result, "upload escape attempt must be detected");
      t.same(result?.payload, "..", "must identify '..' payload");
    });
  });

  t.test("scenario: file download with terminal '..' in path", async () => {
    // Attacker sends: GET /download?file=/uploads/..
    // Application does: fs.readFile(req.query.file)
    // Without fix: reads from parent of /uploads
    // With fix: detected and blocked
    
    const context: Context = {
      remoteAddress: "10.0.0.50",
      method: "GET",
      url: "/download?file=/uploads/..",
      query: { file: "/uploads/.." },
      headers: {},
      body: undefined,
      cookies: {},
      routeParams: {},
      source: "express",
      route: "/download",
    };

    runWithContext(context, () => {
      const result = checkContextForPathTraversal({
        filename: "/uploads/..",
        operation: "fs.readFile",
        context: context,
      }) as { payload: string } | undefined;

      t.ok(result, "download escape attempt must be detected");
      t.same(result?.payload, "/uploads/..", "must identify full path payload");
    });
  });

  t.test("scenario: file deletion with '..' to delete outside allowed directory", async () => {
    // Attacker sends: DELETE /files/.. (route param)
    // Application does: fs.unlink(path.join("/var/app/files", req.params.file))
    // Without fix: could delete files in /var/app
    // With fix: detected and blocked
    
    const context: Context = {
      remoteAddress: "172.16.0.10",
      method: "DELETE",
      url: "/files/..",
      query: {},
      headers: {},
      body: undefined,
      cookies: {},
      routeParams: { file: ".." },
      source: "express",
      route: "/files/:file",
    };

    runWithContext(context, () => {
      const result = checkContextForPathTraversal({
        filename: "/var/app/files/..",
        operation: "fs.unlink",
        context: context,
      }) as { source: string } | undefined;

      t.ok(result, "deletion escape attempt must be detected");
      t.same(result?.source, "routeParams", "must identify route param source");
    });
  });

  t.test("scenario: directory listing with '..' to list parent directory", async () => {
    // Attacker sends: GET /list?dir=..
    // Application does: fs.readdir(path.resolve("/data/public", req.query.dir))
    // Without fix: lists /data directory
    // With fix: detected and blocked
    
    const context: Context = {
      remoteAddress: "203.0.113.42",
      method: "GET",
      url: "/list?dir=..",
      query: { dir: ".." },
      headers: {},
      body: undefined,
      cookies: {},
      routeParams: {},
      source: "express",
      route: "/list",
    };

    runWithContext(context, () => {
      const result = checkContextForPathTraversal({
        filename: "/data/public/..",
        operation: "fs.readdir",
        context: context,
      }) as { operation: string } | undefined;

      t.ok(result, "directory listing escape must be detected");
      t.same(result?.operation, "fs.readdir", "must identify readdir operation");
    });
  });

  t.test("scenario: AWS S3 key with terminal '..' to access parent prefix", async () => {
    // Attacker sends: GET /s3/download?key=uploads/..
    // Application does: s3.getObject({ Key: req.query.key })
    // Without fix: could access objects outside uploads/ prefix
    // With fix: detected and blocked
    
    const context: Context = {
      remoteAddress: "198.51.100.25",
      method: "GET",
      url: "/s3/download?key=uploads/..",
      query: { key: "uploads/.." },
      headers: {},
      body: undefined,
      cookies: {},
      routeParams: {},
      source: "express",
      route: "/s3/download",
    };

    runWithContext(context, () => {
      const result = checkContextForPathTraversal({
        filename: "uploads/..",
        operation: "S3.getObject",
        context: context,
      }) as { payload: string } | undefined;

      t.ok(result, "S3 key escape attempt must be detected");
      t.same(result?.payload, "uploads/..", "must identify S3 key payload");
    });
  });
});

t.test("Terminal double-dot bypass - edge cases", async (t) => {
  t.test("multiple terminal '..' segments", async () => {
    t.same(
      containsUnsafePathParts("/a/b/../.."),
      true,
      "multiple terminal '..' must be detected"
    );
    t.same(
      detectPathTraversal("/a/b/../..", "../.."),
      true,
      "multiple '..' traversal must be detected"
    );
  });

  t.test("'..' with trailing slash is already caught by original logic", async () => {
    // This was already working before the fix
    t.same(
      containsUnsafePathParts("../"),
      true,
      "'../' must be detected"
    );
    t.same(
      containsUnsafePathParts("/path/../"),
      true,
      "'/path/../' must be detected"
    );
  });

  t.test("'..' in filename (not a directory component) should not be flagged", async () => {
    // Files named "..something" or "something.." are not path traversal
    t.same(
      containsUnsafePathParts("/path/..hidden"),
      false,
      "file starting with '..' should not be flagged"
    );
    t.same(
      containsUnsafePathParts("/path/file..txt"),
      false,
      "file containing '..' should not be flagged"
    );
    t.same(
      containsUnsafePathParts("/path/backup.."),
      false,
      "file ending with '..' should not be flagged"
    );
  });

  t.test("single dot '.' is not dangerous", async () => {
    t.same(
      containsUnsafePathParts("."),
      false,
      "single dot should not be flagged"
    );
    t.same(
      containsUnsafePathParts("/path/."),
      false,
      "current directory reference should not be flagged"
    );
  });

  t.test("empty path segments", async () => {
    // Double slashes create empty segments
    t.same(
      containsUnsafePathParts("/path//file"),
      false,
      "double slash should not be flagged"
    );
    t.same(
      containsUnsafePathParts("///path"),
      false,
      "multiple leading slashes should not be flagged"
    );
  });

  t.test("Windows UNC paths with '..'", async () => {
    t.same(
      containsUnsafePathParts("\\\\server\\share\\.."),
      true,
      "UNC path with terminal '..' must be detected"
    );
    t.same(
      containsUnsafePathParts("\\\\server\\share\\..\\file"),
      true,
      "UNC path with '..' must be detected"
    );
  });
});
