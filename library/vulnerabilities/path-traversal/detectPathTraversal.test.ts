import * as t from "tap";
import { detectPathTraversal } from "./detectPathTraversal";

t.test("empty user input", async () => {
  t.same(detectPathTraversal("test.txt", ""), false);
});

t.test("empty file input", async () => {
  t.same(detectPathTraversal("", "test"), false);
});

t.test("empty user input and file input", async () => {
  t.same(detectPathTraversal("", ""), false);
});

t.test("user input is a single character", async () => {
  t.same(detectPathTraversal("test.txt", "t"), false);
});

t.test("file input is a single character", async () => {
  t.same(detectPathTraversal("t", "test"), false);
});

t.test("same as user input", async () => {
  t.same(detectPathTraversal("text.txt", "text.txt"), false);
});

t.test("with directory before", async () => {
  t.same(detectPathTraversal("directory/text.txt", "text.txt"), false);
});

t.test("with both directory before", async () => {
  t.same(
    detectPathTraversal("directory/text.txt", "directory/text.txt"),
    false
  );
});

t.test("user input and file input are single characters", async () => {
  t.same(detectPathTraversal("t", "t"), false);
});

t.test("it flags ../", async () => {
  t.same(detectPathTraversal("../test.txt", "../"), true);
});

t.test("it flags ..\\", async () => {
  t.same(detectPathTraversal("..\\test.txt", "..\\"), true);
});

t.test("it flags ../../", async () => {
  t.same(detectPathTraversal("../../test.txt", "../../"), true);
});

t.test("it flags ..\\..\\", async () => {
  t.same(detectPathTraversal("..\\..\\test.txt", "..\\..\\"), true);
});

t.test("it flags ../../../../", async () => {
  t.same(detectPathTraversal("../../../../test.txt", "../../../../"), true);
});

t.test("it flags ..\\..\\..\\", async () => {
  t.same(detectPathTraversal("..\\..\\..\\test.txt", "..\\..\\..\\"), true);
});

t.test("it flags ./../", async () => {
  t.same(detectPathTraversal("./../test.txt", "./../"), true);
});

t.test("user input is longer than file path", async () => {
  t.same(detectPathTraversal("../file.txt", "../../file.txt"), false);
});

t.test("absolute linux path", async () => {
  t.same(detectPathTraversal("/etc/passwd", "/etc/passwd"), true);
});

t.test("linux user directory", async () => {
  t.same(detectPathTraversal("/home/user/file.txt", "/home/user/"), true);
});

t.test("possible bypass", async () => {
  t.same(detectPathTraversal("/./etc/passwd", "/./etc/passwd"), true);
});

t.test("another bypass", async () => {
  t.same(
    detectPathTraversal("/./././root/test.txt", "/./././root/test.txt"),
    true
  );
  t.same(detectPathTraversal("/./././root/test.txt", "/./././root"), true);
});

t.test("no path traversal", async () => {
  t.same(
    detectPathTraversal("/appdata/storage/file.txt", "/storage/file.txt"),
    false
  );
});

t.test("does not flag test", async () => {
  t.same(detectPathTraversal("/app/test.txt", "test"), false);
});

t.test("does not flag example/test.txt", async () => {
  t.same(
    detectPathTraversal("/app/data/example/test.txt", "example/test.txt"),
    false
  );
});

t.test("does not absolute path with different folder", async () => {
  t.same(detectPathTraversal("/etc/app/config", "/etc/hack/config"), false);
});

t.test("does not absolute path inside another folder", async () => {
  t.same(detectPathTraversal("/etc/app/data/etc/config", "/etc/config"), false);
});

t.test("disable checkPathStart", async () => {
  t.same(detectPathTraversal("/etc/passwd", "/etc/passwd", false), false);
});

t.test(
  "windows drive letter",
  { skip: process.platform !== "win32" ? "Windows only" : false },
  async () => {
    t.same(detectPathTraversal("C:\\file.txt", "C:\\"), true);
  }
);

t.test(
  "does not detect if user input path contains no filename or subfolder",
  async () => {
    t.same(detectPathTraversal("/etc/app/test.txt", "/etc/"), false);
    t.same(detectPathTraversal("/etc/app/", "/etc/"), false);
    t.same(detectPathTraversal("/etc/app/", "/etc"), false);
    t.same(detectPathTraversal("/etc/", "/etc/"), false);
    t.same(detectPathTraversal("/etc", "/etc"), false);
    t.same(detectPathTraversal("/var/a", "/var/"), false);
    t.same(detectPathTraversal("/var/a", "/var/b"), false);
    t.same(detectPathTraversal("/var/a", "/var/b/test.txt"), false);
  }
);

t.test(
  "it does detect if user input path contains a filename or subfolder",
  async () => {
    t.same(detectPathTraversal("/etc/app/file.txt", "/etc/app"), true);
    t.same(detectPathTraversal("/etc/app/file.txt", "/etc/app/file.txt"), true);
    t.same(detectPathTraversal("/var/backups/file.txt", "/var/backups"), true);
    t.same(
      detectPathTraversal("/var/backups/file.txt", "/var/backups/file.txt"),
      true
    );
    t.same(detectPathTraversal("/var/a", "/var/a"), true);
    t.same(detectPathTraversal("/var/a/b", "/var/a"), true);
    t.same(detectPathTraversal("/var/a/b/test.txt", "/var/a"), true);
  }
);

t.test("absolute macOS path", async () => {
  t.same(
    detectPathTraversal("/Applications/Zen.app", "/Applications/Zen.app"),
    true
  );
  t.same(detectPathTraversal("/Users/user/test.txt", "/Users/user/"), true);
  t.same(
    detectPathTraversal(
      "/Volumes/ExternalDrive/test.txt",
      "/Volumes/ExternalDrive/"
    ),
    true
  );
});

t.test("container /app/ directory", async () => {
  t.same(detectPathTraversal("/app/config/secret.yml", "/app/config"), true);
  t.same(
    detectPathTraversal("/app/config/secret.yml", "/app/config/secret.yml"),
    true
  );
  t.same(detectPathTraversal("/app/test.txt", "/app/"), false);
  t.same(detectPathTraversal("/app/test.txt", "/app"), false);
});

t.test("container /code/ directory", async () => {
  t.same(detectPathTraversal("/code/src/index.js", "/code/src"), true);
  t.same(detectPathTraversal("/code/src/index.js", "/code/src/index.js"), true);
  t.same(detectPathTraversal("/code/test.txt", "/code/"), false);
  t.same(detectPathTraversal("/code/test.txt", "/code"), false);
});

t.test("AWS credentials protection", async () => {
  t.same(
    detectPathTraversal(
      "/home/user/.aws/credentials",
      "/home/user/.aws/credentials"
    ),
    true
  );
});

t.test("current directory references (/./) are normalized", async () => {
  t.same(detectPathTraversal("/./etc/passwd", "/./etc"), true);
  t.same(detectPathTraversal("/etc/./passwd", "/etc/./"), true);
  t.same(detectPathTraversal("/etc/./passwd", "/etc/./passwd"), true);
  t.same(detectPathTraversal("/./etc/./passwd", "/./etc/./passwd"), true);
  // Multiple /./ sequences
  t.same(detectPathTraversal("/././etc/passwd", "/././etc"), true);
  t.same(detectPathTraversal("/etc/././passwd", "/etc/././passwd"), true);
});

t.test("paths with multiple slashes are normalized", async () => {
  t.same(detectPathTraversal("///.///etc/passwd", "///.///etc"), true);
  t.same(detectPathTraversal("///.///etc/passwd", "///.///etc/passwd"), true);
});

t.test(
  "normalized paths still trigger false positive prevention for bare root dirs",
  async () => {
    // User input that resolves to just a root dir should still be safe
    t.same(detectPathTraversal("/etc/./passwd", "/etc"), false);
    t.same(detectPathTraversal("//etc//passwd", "/etc"), false);
  }
);

t.test(
  "case-insensitive comparison detects traversal on case-insensitive filesystems",
  async () => {
    t.same(detectPathTraversal("/etc/passwd", "/ETC/passwd"), true);
    t.same(detectPathTraversal("/etc/passwd", "/ETC/PASSWD"), true);
    t.same(
      detectPathTraversal("/home/user/file.txt", "/HOME/USER/file.txt"),
      true
    );
    t.same(detectPathTraversal("../test.txt", "../"), true);
  }
);

t.test(
  "it detects path traversal with embedded control characters in file URL scheme",
  async () => {
    // Attack: fi\nle:///../../etc/passwd
    // When used in new URL(`file:///public/${searchTerm}`), the URL parser:
    // 1. Removes \n from the entire string
    // 2. Resolves the path
    // The detector must recognize this as a file URL despite the embedded control char
    t.same(
      detectPathTraversal("/etc/passwd", "fi\nle:///../../etc/passwd", true, true),
      true
    );
    t.same(
      detectPathTraversal("/etc/passwd", "fi\tle:///../../etc/passwd", true, true),
      true
    );
    t.same(
      detectPathTraversal("/etc/passwd", "fi\rle:///../../etc/passwd", true, true),
      true
    );
    // Multiple control characters
    t.same(
      detectPathTraversal("/etc/passwd", "f\ni\tle:///../../etc/passwd", true, true),
      true
    );
    // With leading control characters
    t.same(
      detectPathTraversal("/etc/passwd", "\tfi\nle:///../../etc/passwd", true, true),
      true
    );
    t.same(
      detectPathTraversal("/etc/passwd", "\n\tfile:///../../etc/passwd", true, true),
      true
    );
  }
);

t.test(
  "pentest exploit: embedded newline in file URL bypasses path traversal detection",
  async () => {
    // This is the exact exploit from the pentest finding:
    // Input: ../fi\nle:///../../etc/passwd
    // When interpolated into new URL(`file:///public/${searchTerm}`):
    // - WHATWG URL parser removes \n and resolves to /etc/passwd
    // - Old isFileUrlString didn't recognize "fi\nle:" as "file:"
    // - parseAsFileUrl converted a different path, bypassing the check
    
    // The fix ensures isFileUrlString applies the same normalization as WHATWG URL parser
    t.same(
      detectPathTraversal("/etc/passwd", "../fi\nle:///../../etc/passwd", true, true),
      true,
      "should detect traversal with embedded newline in file URL scheme"
    );
  }
);

t.test(
  "embedded control characters in various positions of file URL scheme",
  async () => {
    // Control character after 'f'
    t.same(
      detectPathTraversal("/etc/passwd", "f\nile:///../../etc/passwd", true, true),
      true,
      "newline after 'f'"
    );
    
    // Control character after 'fi'
    t.same(
      detectPathTraversal("/etc/passwd", "fi\nle:///../../etc/passwd", true, true),
      true,
      "newline after 'fi'"
    );
    
    // Control character after 'fil'
    t.same(
      detectPathTraversal("/etc/passwd", "fil\ne:///../../etc/passwd", true, true),
      true,
      "newline after 'fil'"
    );
    
    // Control character in colon
    t.same(
      detectPathTraversal("/etc/passwd", "file\n:///../../etc/passwd", true, true),
      true,
      "newline before colon"
    );
    
    // Tab character variants
    t.same(
      detectPathTraversal("/etc/passwd", "f\tile:///../../etc/passwd", true, true),
      true,
      "tab after 'f'"
    );
    
    t.same(
      detectPathTraversal("/etc/passwd", "fi\tle:///../../etc/passwd", true, true),
      true,
      "tab after 'fi'"
    );
    
    // Carriage return variants
    t.same(
      detectPathTraversal("/etc/passwd", "f\rile:///../../etc/passwd", true, true),
      true,
      "carriage return after 'f'"
    );
    
    t.same(
      detectPathTraversal("/etc/passwd", "fi\rle:///../../etc/passwd", true, true),
      true,
      "carriage return after 'fi'"
    );
  }
);

t.test(
  "multiple embedded control characters in file URL scheme",
  async () => {
    // Multiple newlines
    t.same(
      detectPathTraversal("/etc/passwd", "f\ni\nle:///../../etc/passwd", true, true),
      true,
      "multiple newlines"
    );
    
    // Mix of tab and newline
    t.same(
      detectPathTraversal("/etc/passwd", "f\ni\tle:///../../etc/passwd", true, true),
      true,
      "newline and tab"
    );
    
    // Mix of all three control characters
    t.same(
      detectPathTraversal("/etc/passwd", "f\ni\tl\re:///../../etc/passwd", true, true),
      true,
      "newline, tab, and carriage return"
    );
    
    // Multiple control characters in sequence
    t.same(
      detectPathTraversal("/etc/passwd", "fi\n\t\rle:///../../etc/passwd", true, true),
      true,
      "multiple control characters in sequence"
    );
  }
);

t.test(
  "leading and trailing control characters with embedded controls in file URL",
  async () => {
    // Leading tab with embedded newline
    t.same(
      detectPathTraversal("/etc/passwd", "\tfi\nle:///../../etc/passwd", true, true),
      true,
      "leading tab with embedded newline"
    );
    
    // Leading newline with embedded tab
    t.same(
      detectPathTraversal("/etc/passwd", "\nfi\tle:///../../etc/passwd", true, true),
      true,
      "leading newline with embedded tab"
    );
    
    // Multiple leading control characters
    t.same(
      detectPathTraversal("/etc/passwd", "\n\t\rfi\nle:///../../etc/passwd", true, true),
      true,
      "multiple leading control characters"
    );
    
    // Leading and embedded control characters
    t.same(
      detectPathTraversal("/etc/passwd", "\n\tfi\nle:///../../etc/passwd", true, true),
      true,
      "leading and embedded control characters"
    );
    
    // C0 control characters (U+0000 to U+0020) at the beginning
    t.same(
      detectPathTraversal("/etc/passwd", "\u0001\u0002file:///../../etc/passwd", true, true),
      true,
      "C0 control characters at beginning"
    );
    
    // Space at beginning (U+0020)
    t.same(
      detectPathTraversal("/etc/passwd", " file:///../../etc/passwd", true, true),
      true,
      "space at beginning"
    );
    
    // Multiple spaces and tabs at beginning
    t.same(
      detectPathTraversal("/etc/passwd", "  \t\nfile:///../../etc/passwd", true, true),
      true,
      "multiple spaces and tabs at beginning"
    );
  }
);

t.test(
  "real-world attack scenarios with embedded controls",
  async () => {
    // Simulating the Express pattern from the pentest:
    // const searchTerm = req.query.q as string;
    // const fileUrl = new URL(`file:///public/${searchTerm}`);
    // readFile(fileUrl, "utf-8", ...)
    
    // Attack payload: ../fi\nle:///../../etc/passwd
    // Results in: file:///public/../fi\nle:///../../etc/passwd
    // WHATWG URL parser normalizes to: file:///etc/passwd
    const attackPayload = "../fi\nle:///../../etc/passwd";
    t.same(
      detectPathTraversal("/etc/passwd", attackPayload, true, true),
      true,
      "should detect the pentest exploit payload"
    );
    
    // Variant with tab
    const attackPayloadTab = "../fi\tle:///../../etc/passwd";
    t.same(
      detectPathTraversal("/etc/passwd", attackPayloadTab, true, true),
      true,
      "should detect exploit with tab character"
    );
    
    // Variant with carriage return
    const attackPayloadCR = "../fi\rle:///../../etc/passwd";
    t.same(
      detectPathTraversal("/etc/passwd", attackPayloadCR, true, true),
      true,
      "should detect exploit with carriage return"
    );
    
    // Accessing AWS credentials
    const awsAttack = "../fi\nle:///../../home/user/.aws/credentials";
    t.same(
      detectPathTraversal("/home/user/.aws/credentials", awsAttack, true, true),
      true,
      "should detect AWS credentials access attempt"
    );
    
    // Accessing SSH keys
    const sshAttack = "../fi\nle:///../../home/user/.ssh/id_rsa";
    t.same(
      detectPathTraversal("/home/user/.ssh/id_rsa", sshAttack, true, true),
      true,
      "should detect SSH key access attempt"
    );
    
    // Accessing environment files
    const envAttack = "../fi\nle:///../../app/.env";
    t.same(
      detectPathTraversal("/app/.env", envAttack, true, true),
      true,
      "should detect .env file access attempt"
    );
  }
);

t.test(
  "embedded controls should not affect non-file-URL paths",
  async () => {
    // Regular paths with embedded controls should still be detected if they contain traversal
    t.same(
      detectPathTraversal("../test.txt", "../test\n.txt", true, false),
      false,
      "embedded newline in regular path without isUrl flag"
    );
    
    // But with isUrl flag, even non-file URLs should be checked
    t.same(
      detectPathTraversal("/etc/passwd", "../\netc/passwd", true, true),
      true,
      "embedded newline in path with isUrl flag"
    );
  }
);

t.test(
  "verify isFileUrlString normalization matches WHATWG URL parser",
  async () => {
    // These tests verify that our fix applies the same normalization as WHATWG URL parser
    // According to https://url.spec.whatwg.org/#url-parsing:
    // 1. Remove leading and trailing C0 controls and space (U+0000 to U+0020)
    // 2. Remove all ASCII tab or newline (U+0009 TAB, U+000A LF, U+000D CR) from anywhere
    
    // Test that embedded controls are properly handled
    t.same(
      detectPathTraversal("/etc/passwd", "fi\nle:///../../etc/passwd", true, true),
      true,
      "embedded newline should be normalized"
    );
    
    t.same(
      detectPathTraversal("/etc/passwd", "fi\tle:///../../etc/passwd", true, true),
      true,
      "embedded tab should be normalized"
    );
    
    t.same(
      detectPathTraversal("/etc/passwd", "fi\rle:///../../etc/passwd", true, true),
      true,
      "embedded carriage return should be normalized"
    );
    
    // Test that leading/trailing C0 controls are properly handled
    t.same(
      detectPathTraversal("/etc/passwd", "\u0000file:///../../etc/passwd", true, true),
      true,
      "leading null character should be normalized"
    );
    
    t.same(
      detectPathTraversal("/etc/passwd", "\u0020file:///../../etc/passwd", true, true),
      true,
      "leading space should be normalized"
    );
    
    // Test trailing controls
    t.same(
      detectPathTraversal("/etc/passwd", "file:///../../etc/passwd\u0000", true, true),
      true,
      "trailing null character should be normalized"
    );
    
    t.same(
      detectPathTraversal("/etc/passwd", "file:///../../etc/passwd\u0020", true, true),
      true,
      "trailing space should be normalized"
    );
  }
);

t.test(
  "edge cases with control characters and percent encoding",
  async () => {
    // Combining embedded controls with percent-encoded dots
    t.same(
      detectPathTraversal("/etc/passwd", "fi\nle:///%2e%2e/%2e%2e/etc/passwd", true, true),
      true,
      "embedded control with percent-encoded dots"
    );
    
    // Multiple traversal patterns with embedded controls
    t.same(
      detectPathTraversal("/etc/passwd", "fi\nle:///../../etc/passwd", true, true),
      true,
      "standard traversal with embedded control"
    );
    
    t.same(
      detectPathTraversal("/etc/passwd", "fi\nle:///./../.../etc/passwd", true, true),
      true,
      "complex traversal with embedded control"
    );
  }
);
