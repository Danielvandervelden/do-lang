"use strict";

/**
 * Unit tests for bin/expand-templates.cjs
 *
 * Tests at current location (skills/scripts/__tests__/).
 * 
 *
 * Run: node --test skills/scripts/__tests__/expand-templates.test.cjs
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..", "..");
const { expandTemplate } = require(path.join(ROOT, "bin", "expand-templates.cjs"));

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Quick alias to test both platforms. */
function bothPlatforms(fn) {
  fn("claude");
  fn("codex");
}

// ---------------------------------------------------------------------------
// Simple substitution markers
// ---------------------------------------------------------------------------

describe("<<DO:AGENT_PREFIX>>", () => {
  it("expands to 'do' for claude", () => {
    assert.equal(expandTemplate("<<DO:AGENT_PREFIX>>", "claude"), "do");
  });

  it("expands to 'codex' for codex", () => {
    assert.equal(expandTemplate("<<DO:AGENT_PREFIX>>", "codex"), "codex");
  });

  it("expands multiple occurrences", () => {
    const input = "<<DO:AGENT_PREFIX>>-planner and <<DO:AGENT_PREFIX>>-executioner";
    assert.equal(expandTemplate(input, "claude"), "do-planner and do-executioner");
    assert.equal(expandTemplate(input, "codex"), "codex-planner and codex-executioner");
  });
});

describe("<<DO:SCRIPTS_PATH>>", () => {
  it("expands to claude path for claude", () => {
    assert.equal(
      expandTemplate("<<DO:SCRIPTS_PATH>>", "claude"),
      "~/.claude/commands/do/scripts"
    );
  });

  it("expands to codex path for codex", () => {
    assert.equal(
      expandTemplate("<<DO:SCRIPTS_PATH>>", "codex"),
      "~/.codex/skills/do/scripts"
    );
  });

  it("can appear inside a sentence", () => {
    const input = "Scripts live at <<DO:SCRIPTS_PATH>>/load-task-context.cjs";
    assert.equal(
      expandTemplate(input, "claude"),
      "Scripts live at ~/.claude/commands/do/scripts/load-task-context.cjs"
    );
  });
});

// ---------------------------------------------------------------------------
// {{...}} passthrough — runtime placeholders must pass unchanged
// ---------------------------------------------------------------------------

describe("{{...}} passthrough", () => {
  const cases = [
    "{{TASK_ID}}",
    "{{VISION_ANSWER}}",
    "{{#if USER_OVERRIDE}}yes{{/if}}",
    "{{#if BELOW_THRESHOLD}}warn{{/if}}",
    "{{/if}}",
  ];

  for (const c of cases) {
    it(`passes through verbatim: ${c}`, () => {
      bothPlatforms((p) => {
        assert.equal(expandTemplate(c, p), c);
      });
    });
  }

  it("passes through {{...}} when mixed with <<DO:...>> markers", () => {
    const input = "id={{TASK_ID}} prefix=<<DO:AGENT_PREFIX>>";
    assert.equal(expandTemplate(input, "claude"), "id={{TASK_ID}} prefix=do");
    assert.equal(expandTemplate(input, "codex"), "id={{TASK_ID}} prefix=codex");
  });
});

// ---------------------------------------------------------------------------
// Conditional blocks
// ---------------------------------------------------------------------------

describe("<<DO:IF CLAUDE>> / <<DO:ENDIF>>", () => {
  it("includes block for claude, strips for codex", () => {
    const input = "<<DO:IF CLAUDE>>\nclaudeOnly\n<<DO:ENDIF>>\nshared";
    assert.equal(expandTemplate(input, "claude"), "claudeOnly\nshared");
    assert.equal(expandTemplate(input, "codex"), "shared");
  });

  it("empty block is handled without leaving blank lines", () => {
    const input = "before\n<<DO:IF CLAUDE>>\n<<DO:ENDIF>>\nafter";
    assert.equal(expandTemplate(input, "claude"), "before\nafter");
    assert.equal(expandTemplate(input, "codex"), "before\nafter");
  });
});

describe("<<DO:IF CODEX>> / <<DO:ENDIF>>", () => {
  it("includes block for codex, strips for claude", () => {
    const input = "<<DO:IF CODEX>>\ncodexOnly\n<<DO:ENDIF>>\nshared";
    assert.equal(expandTemplate(input, "codex"), "codexOnly\nshared");
    assert.equal(expandTemplate(input, "claude"), "shared");
  });
});

describe("Adjacent conditional blocks", () => {
  it("claude block followed by codex block", () => {
    const input =
      "<<DO:IF CLAUDE>>\nfor claude\n<<DO:ENDIF>>\n<<DO:IF CODEX>>\nfor codex\n<<DO:ENDIF>>\ntail";
    assert.equal(expandTemplate(input, "claude"), "for claude\ntail");
    assert.equal(expandTemplate(input, "codex"), "for codex\ntail");
  });
});

describe("Nested conditionals", () => {
  it("nested same-platform blocks", () => {
    const input =
      "<<DO:IF CLAUDE>>\nouter\n<<DO:IF CLAUDE>>\ninner\n<<DO:ENDIF>>\n<<DO:ENDIF>>\ntail";
    assert.equal(expandTemplate(input, "claude"), "outer\ninner\ntail");
    assert.equal(expandTemplate(input, "codex"), "tail");
  });

  it("outer codex block with inner claude block (inner never emitted)", () => {
    // When we are expanding for claude: outer CODEX block is stripped,
    // inner CLAUDE block inside it is also stripped.
    const input =
      "<<DO:IF CODEX>>\nouter codex\n<<DO:IF CLAUDE>>\nnested claude\n<<DO:ENDIF>>\n<<DO:ENDIF>>\ntail";
    // For claude: outer CODEX block stripped entirely including its content
    assert.equal(expandTemplate(input, "claude"), "tail");
    // For codex: outer CODEX active, inner CLAUDE stripped
    assert.equal(expandTemplate(input, "codex"), "outer codex\ntail");
  });
});

describe("Markers inside code fences", () => {
  it("code fence content is expanded normally", () => {
    const input =
      "```js\nAgent({\n  prefix: '<<DO:AGENT_PREFIX>>'\n})\n```";
    assert.equal(
      expandTemplate(input, "claude"),
      "```js\nAgent({\n  prefix: 'do'\n})\n```"
    );
  });

  it("IF blocks inside code fences", () => {
    const input =
      "```\n<<DO:IF CLAUDE>>\nclaudeLine\n<<DO:ENDIF>>\n```";
    assert.equal(expandTemplate(input, "claude"), "```\nclaudeLine\n```");
    assert.equal(expandTemplate(input, "codex"), "```\n```");
  });
});

describe("Markers at file start / end", () => {
  it("marker at very start", () => {
    assert.equal(expandTemplate("<<DO:AGENT_PREFIX>>-task", "claude"), "do-task");
  });

  it("marker at very end (no trailing newline)", () => {
    assert.equal(expandTemplate("prefix: <<DO:AGENT_PREFIX>>", "codex"), "prefix: codex");
  });

  it("IF block at file start", () => {
    const input = "<<DO:IF CLAUDE>>\nfirst line\n<<DO:ENDIF>>\nrest";
    assert.equal(expandTemplate(input, "claude"), "first line\nrest");
    assert.equal(expandTemplate(input, "codex"), "rest");
  });

  it("IF block at file end", () => {
    const input = "start\n<<DO:IF CODEX>>\nlast line\n<<DO:ENDIF>>";
    assert.equal(expandTemplate(input, "codex"), "start\nlast line\n");
    // The \n after "start" is part of "start"'s line, not the stripped block
    assert.equal(expandTemplate(input, "claude"), "start\n");
  });
});

// ---------------------------------------------------------------------------
// Inline platform-specific text: <<DO:CLAUDE:text>> / <<DO:CODEX:text>>
// ---------------------------------------------------------------------------

describe("Inline platform markers — whole line", () => {
  it("<<DO:CLAUDE:text>> expands to text on claude", () => {
    const input = "before\n<<DO:CLAUDE:use the Agent tool>>\nafter";
    assert.equal(expandTemplate(input, "claude"), "before\nuse the Agent tool\nafter");
  });

  it("<<DO:CLAUDE:text>> strips entire line on codex (no blank line)", () => {
    const input = "before\n<<DO:CLAUDE:use the Agent tool>>\nafter";
    assert.equal(expandTemplate(input, "codex"), "before\nafter");
  });

  it("<<DO:CODEX:text>> expands to text on codex", () => {
    const input = "before\n<<DO:CODEX:Spawn the codex-planner subagent>>\nafter";
    assert.equal(expandTemplate(input, "codex"), "before\nSpawn the codex-planner subagent\nafter");
  });

  it("<<DO:CODEX:text>> strips entire line on claude (no blank line)", () => {
    const input = "before\n<<DO:CODEX:Spawn the codex-planner subagent>>\nafter";
    assert.equal(expandTemplate(input, "claude"), "before\nafter");
  });

  it("strips whole line even with leading whitespace/indentation", () => {
    const input = "before\n  <<DO:CLAUDE:indented text>>\nafter";
    assert.equal(expandTemplate(input, "claude"), "before\n  indented text\nafter");
    assert.equal(expandTemplate(input, "codex"), "before\nafter");
  });

  it("whole-line at very beginning of file", () => {
    const input = "<<DO:CLAUDE:first line>>\nrest";
    assert.equal(expandTemplate(input, "claude"), "first line\nrest");
    assert.equal(expandTemplate(input, "codex"), "rest");
  });

  it("whole-line at very end of file without trailing newline", () => {
    const input = "start\n<<DO:CLAUDE:last line>>";
    assert.equal(expandTemplate(input, "claude"), "start\nlast line");
    // The \n before the marker line belongs to "start", not to the stripped line
    assert.equal(expandTemplate(input, "codex"), "start\n");
  });
});

describe("Inline platform markers — mid-line", () => {
  it("mid-line <<DO:CLAUDE:text>>: text preserved on claude", () => {
    const input = "See <<DO:CLAUDE:Agent tool>> for details";
    assert.equal(expandTemplate(input, "claude"), "See Agent tool for details");
  });

  it("mid-line <<DO:CLAUDE:text>>: only marker removed on codex", () => {
    const input = "See <<DO:CLAUDE:Agent tool>> for details";
    assert.equal(expandTemplate(input, "codex"), "See  for details");
  });

  it("mid-line <<DO:CODEX:text>>: text preserved on codex", () => {
    const input = "Use <<DO:CODEX:spawn_agent>> to spawn";
    assert.equal(expandTemplate(input, "codex"), "Use spawn_agent to spawn");
  });

  it("mid-line <<DO:CODEX:text>>: only marker removed on claude", () => {
    const input = "Use <<DO:CODEX:spawn_agent>> to spawn";
    assert.equal(expandTemplate(input, "claude"), "Use  to spawn");
  });
});

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

describe("Error: unknown markers", () => {
  it("throws for <<DO:FOOBAR>>", () => {
    assert.throws(
      () => expandTemplate("<<DO:FOOBAR>>", "claude"),
      /unrecognized marker/
    );
  });

  it("throws for <<DO:UNKNOWN_TOKEN>>", () => {
    assert.throws(
      () => expandTemplate("text <<DO:UNKNOWN_TOKEN>> text", "codex"),
      /unrecognized marker/
    );
  });
});

describe("Error: invalid platform in IF", () => {
  it("throws for <<DO:IF FOOBAR>>", () => {
    assert.throws(
      () => expandTemplate("<<DO:IF FOOBAR>>\n<<DO:ENDIF>>", "claude"),
      /invalid platform/
    );
  });
});

describe("Error: invalid platform in inline marker", () => {
  it("throws for <<DO:FOOBAR:text>>", () => {
    assert.throws(
      () => expandTemplate("<<DO:FOOBAR:some text>>", "claude"),
      /invalid platform/
    );
  });
});

describe("Error: unclosed IF block", () => {
  it("throws when <<DO:IF CLAUDE>> has no matching <<DO:ENDIF>>", () => {
    assert.throws(
      () => expandTemplate("<<DO:IF CLAUDE>>\nno endif", "claude"),
      /unclosed conditional/
    );
  });

  it("throws for nested unclosed block", () => {
    assert.throws(
      () =>
        expandTemplate(
          "<<DO:IF CLAUDE>>\n<<DO:IF CODEX>>\n<<DO:ENDIF>>\nno outer endif",
          "claude"
        ),
      /unclosed conditional/
    );
  });
});

describe("Error: unmatched ENDIF", () => {
  it("throws when <<DO:ENDIF>> has no open IF", () => {
    assert.throws(
      () => expandTemplate("text\n<<DO:ENDIF>>\n", "claude"),
      /without matching/
    );
  });
});

describe("Error: invalid expandTemplate platform argument", () => {
  it("throws for unknown platform string", () => {
    assert.throws(
      () => expandTemplate("content", "windows"),
      /invalid platform/
    );
  });
});

// ---------------------------------------------------------------------------
// Whitespace and newline preservation
// ---------------------------------------------------------------------------

describe("Whitespace preservation", () => {
  it("preserves trailing newline at end of file", () => {
    const input = "line one\nline two\n";
    bothPlatforms((p) => {
      assert.equal(expandTemplate(input, p), "line one\nline two\n");
    });
  });

  it("preserves multiple blank lines inside active block", () => {
    const input = "<<DO:IF CLAUDE>>\nline1\n\nline3\n<<DO:ENDIF>>\ntail";
    assert.equal(expandTemplate(input, "claude"), "line1\n\nline3\ntail");
  });

  it("preserves whitespace-only lines", () => {
    const input = "a\n   \nb";
    bothPlatforms((p) => {
      assert.equal(expandTemplate(input, p), "a\n   \nb");
    });
  });
});

// ---------------------------------------------------------------------------
// Combination scenarios
// ---------------------------------------------------------------------------

describe("Combined markers in realistic content", () => {
  it("agent prefix + scripts path + conditional in one template", () => {
    const input = [
      "# <<DO:AGENT_PREFIX>>-planner",
      "",
      "Scripts: <<DO:SCRIPTS_PATH>>",
      "",
      "<<DO:IF CLAUDE>>",
      "allowed-tools:",
      "  - Agent",
      "<<DO:ENDIF>>",
      "<<DO:IF CODEX>>",
      "## Agent Authorization",
      "This agent may spawn others.",
      "<<DO:ENDIF>>",
    ].join("\n");

    const claude = expandTemplate(input, "claude");
    assert.ok(claude.includes("# do-planner"), "claude prefix");
    assert.ok(claude.includes("~/.claude/commands/do/scripts"), "claude path");
    assert.ok(claude.includes("  - Agent"), "claude tools list");
    assert.ok(!claude.includes("Agent Authorization"), "no codex auth in claude");

    const codex = expandTemplate(input, "codex");
    assert.ok(codex.includes("# codex-planner"), "codex prefix");
    assert.ok(codex.includes("~/.codex/skills/do/scripts"), "codex path");
    assert.ok(!codex.includes("- Agent"), "no claude tools in codex");
    assert.ok(codex.includes("Agent Authorization"), "codex auth present");
  });

  it("inline markers and block markers coexist", () => {
    // Note: <<DO:...>> markers cannot be nested inside <<DO:PLATFORM:text>> inline
    // markers — the text portion is literal. Use adjacent markers or IF blocks instead.
    const input = [
      "<<DO:IF CLAUDE>>",
      "```js",
      "Agent({ skill: '<<DO:AGENT_PREFIX>>-planner' })",
      "```",
      "<<DO:ENDIF>>",
      "<<DO:CLAUDE:Use the Agent tool above>>",
      "<<DO:CODEX:Use spawn_agent to spawn the codex-planner>>",
    ].join("\n");

    const claude = expandTemplate(input, "claude");
    assert.ok(claude.includes("Agent({ skill: 'do-planner' })"), "claude spawn");
    assert.ok(claude.includes("Use the Agent tool above"), "claude inline");
    assert.ok(!claude.includes("spawn_agent"), "no codex inline on claude");

    const codex = expandTemplate(input, "codex");
    assert.ok(!codex.includes("```js"), "no code fence on codex");
    assert.ok(codex.includes("spawn_agent"), "codex inline present");
    assert.ok(codex.includes("codex-planner"), "codex prefix in inline");
  });
});
