#!/usr/bin/env node
"use strict";

/**
 * expand-templates.cjs
 *
 * Expansion engine for do-lang skill/agent template files.
 *
 * Marker syntax (all markers use <<DO:...>> delimiters to avoid collision
 * with existing runtime placeholders like {{TASK_ID}}, {{#if ...}}, etc.):
 *
 *   <<DO:AGENT_PREFIX>>         -> "do" (claude) or "codex" (codex)
 *   <<DO:SCRIPTS_PATH>>         -> "~/.claude/commands/do/scripts" (claude)
 *                                  or "~/.codex/skills/do/scripts" (codex)
 *
 *   <<DO:IF CLAUDE>>            -> include block for claude, strip for codex
 *   ...content...
 *   <<DO:ENDIF>>
 *
 *   <<DO:IF CODEX>>             -> include block for codex, strip for claude
 *   ...content...
 *   <<DO:ENDIF>>
 *
 *   <<DO:CLAUDE:some text>>     -> inline: expands to "some text" on claude,
 *                                  entire line removed on codex
 *   <<DO:CODEX:some text>>      -> inline: expands to "some text" on codex,
 *                                  entire line removed on claude
 *
 * All {{...}} content passes through verbatim, unchanged.
 * Unknown <<DO:...>> markers throw an error (fail-fast).
 * Nested conditionals are supported via a stack parser.
 */

const fs = require("fs");
const path = require("path");

const PLATFORMS = ["claude", "codex"];

const SUBSTITUTIONS = {
  claude: {
    AGENT_PREFIX: "do",
    SCRIPTS_PATH: "~/.claude/commands/do/scripts",
  },
  codex: {
    AGENT_PREFIX: "codex",
    SCRIPTS_PATH: "~/.codex/skills/do/scripts",
  },
};

// Token types produced by the scanner
const T = {
  TEXT: "TEXT",
  AGENT_PREFIX: "AGENT_PREFIX",
  SCRIPTS_PATH: "SCRIPTS_PATH",
  IF: "IF",
  ENDIF: "ENDIF",
  INLINE: "INLINE",
};

/**
 * Tokenize `content` into an array of tokens.
 * Each token is one of:
 *   { type: 'TEXT',         value: string }
 *   { type: 'AGENT_PREFIX'                }
 *   { type: 'SCRIPTS_PATH'               }
 *   { type: 'IF',           platform: 'CLAUDE'|'CODEX' }
 *   { type: 'ENDIF'                       }
 *   { type: 'INLINE',       platform: 'CLAUDE'|'CODEX', text: string,
 *                            wholeLine: boolean, linePrefix: string, lineSuffix: string }
 *
 * Throws on any unrecognized <<DO:...>> marker.
 */
function tokenize(content) {
  const tokens = [];
  // Regex matches <<DO:...>> markers (non-greedy inner match, no nested <<>>)
  const markerRe = /<<DO:([^>]*)>>/g;
  let lastIndex = 0;
  let match;

  while ((match = markerRe.exec(content)) !== null) {
    const markerStart = match.index;
    const markerEnd = markerRe.lastIndex;
    const inner = match[1]; // everything between <<DO: and >>

    // Emit preceding text token
    if (markerStart > lastIndex) {
      tokens.push({ type: T.TEXT, value: content.slice(lastIndex, markerStart) });
    }
    lastIndex = markerEnd;

    // Parse the inner marker
    if (inner === "AGENT_PREFIX") {
      tokens.push({ type: T.AGENT_PREFIX });
    } else if (inner === "SCRIPTS_PATH") {
      tokens.push({ type: T.SCRIPTS_PATH });
    } else if (inner === "ENDIF") {
      tokens.push({ type: T.ENDIF });
    } else if (inner.startsWith("IF ")) {
      const platformTag = inner.slice(3).trim().toUpperCase();
      if (platformTag !== "CLAUDE" && platformTag !== "CODEX") {
        throw new Error(
          `expand-templates: invalid platform in <<DO:IF ${inner.slice(3)}>> — expected CLAUDE or CODEX`
        );
      }
      tokens.push({ type: T.IF, platform: platformTag });
    } else {
      // Check for inline platform markers: <<DO:CLAUDE:text>> or <<DO:CODEX:text>>
      const colonIdx = inner.indexOf(":");
      if (colonIdx !== -1) {
        const platformTag = inner.slice(0, colonIdx).toUpperCase();
        if (platformTag !== "CLAUDE" && platformTag !== "CODEX") {
          throw new Error(
            `expand-templates: invalid platform in <<DO:${inner}>> — expected CLAUDE or CODEX`
          );
        }
        const inlineText = inner.slice(colonIdx + 1);

        // Determine whether this marker occupies the whole line so we can
        // strip the entire line (including its newline) when not matching.
        // "Whole line" means: the only content on this line (ignoring
        // surrounding whitespace/indentation) is the marker itself.
        const lineStart = content.lastIndexOf("\n", markerStart - 1) + 1;
        const rawLineEnd = content.indexOf("\n", markerEnd);
        const lineEnd = rawLineEnd === -1 ? content.length : rawLineEnd;
        const lineContent = content.slice(lineStart, lineEnd);
        const markerInLine = match[0]; // full "<<DO:...>>" string
        const beforeMarker = content.slice(lineStart, markerStart);
        const afterMarker = content.slice(markerEnd, lineEnd);
        const wholeLine =
          beforeMarker.trim() === "" && afterMarker.trim() === "";

        tokens.push({
          type: T.INLINE,
          platform: platformTag,
          text: inlineText,
          wholeLine,
          // Preserve text before/after marker for mid-line case
          linePrefix: beforeMarker,
          lineSuffix: afterMarker,
          // Track where the line starts/ends for whole-line removal
          lineStart,
          lineEnd,
          // The full marker string for reference
          markerString: markerInLine,
        });
      } else {
        throw new Error(
          `expand-templates: unrecognized marker <<DO:${inner}>> — valid markers are AGENT_PREFIX, SCRIPTS_PATH, IF CLAUDE, IF CODEX, ENDIF, CLAUDE:text, CODEX:text`
        );
      }
    }
  }

  // Trailing text after last marker
  if (lastIndex < content.length) {
    tokens.push({ type: T.TEXT, value: content.slice(lastIndex) });
  }

  return tokens;
}

/**
 * Expand a tokenized stream for the given platform using a stack parser.
 *
 * @param {Array} tokens
 * @param {'claude'|'codex'} platform
 * @returns {string} Expanded content
 */
function expandTokens(tokens, platform) {
  const platformUpper = platform.toUpperCase(); // "CLAUDE" or "CODEX"
  const subs = SUBSTITUTIONS[platform];

  // Stack tracks nested IF blocks.
  // Each frame: { platform: 'CLAUDE'|'CODEX', active: boolean }
  // active = true when this block's platform matches AND all outer frames are active
  const stack = [];

  // Are we currently inside an active (included) block?
  function isActive() {
    return stack.every((frame) => frame.active);
  }

  // We'll build the output as an array of string chunks, then join.
  // For whole-line INLINE markers we need to handle the newline carefully.
  // Instead of building chunk arrays, we'll process tokens to a string.
  let out = "";

  // For whole-line INLINE removal we need to also remove the trailing newline.
  // We track whether the last thing we emitted was a "line-removed" signal.
  // Actually, let's handle this via a different approach: we'll re-process
  // the original content with position tracking.

  // Approach: build output segments in order.
  // TEXT tokens are included verbatim (when active).
  // INLINE whole-line: when non-matching, we must suppress not just the marker
  //   but the whole line including its leading whitespace and trailing newline.
  //   We handle this by trimming the TEXT token that ends right before the line,
  //   but since tokenization already split at marker boundaries, we need to
  //   reconstruct line handling here.

  // Simpler approach: collect output parts; for whole-line non-matching INLINE,
  // trim the trailing portion of the previous TEXT token (up to and including
  // the last \n before the line) and skip the line's suffix + newline.
  // We handle this via a "pending" mechanism.

  // Let's redesign: use segment tracking.
  // Each iteration produces either a string segment or a special "eat-eol" signal.

  const parts = []; // Array<string | { eatEOL: true }>

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    switch (tok.type) {
      case T.TEXT:
        if (isActive()) {
          parts.push(tok.value);
        }
        break;

      case T.AGENT_PREFIX:
        if (isActive()) {
          parts.push(subs.AGENT_PREFIX);
        }
        break;

      case T.SCRIPTS_PATH:
        if (isActive()) {
          parts.push(subs.SCRIPTS_PATH);
        }
        break;

      case T.IF: {
        const blockActive = isActive() && tok.platform === platformUpper;
        stack.push({ platform: tok.platform, active: blockActive });
        // The IF marker line itself is stripped (it's a control line).
        // We need to also strip the newline after the IF marker.
        // BUT: only when the block is active. When inactive, the newline after
        // the IF marker is part of the block content that will be skipped.
        // Eating it here would "reach past" the block and eat from content after ENDIF.
        if (blockActive) {
          parts.push({ eatLeadingNewline: true });
        }
        break;
      }

      case T.ENDIF: {
        if (stack.length === 0) {
          throw new Error(
            "expand-templates: <<DO:ENDIF>> without matching <<DO:IF ...>>"
          );
        }
        stack.pop();
        // Strip the ENDIF marker line's trailing newline too.
        parts.push({ eatLeadingNewline: true });
        break;
      }

      case T.INLINE: {
        if (!isActive()) break;

        const matching = tok.platform === platformUpper;

        if (matching) {
          // Emit the text content of the inline marker.
          // If it was a whole-line marker, we need to keep linePrefix and
          // lineSuffix (which are whitespace around the marker on its line)
          // but for whole-line case those are empty (we checked trim() === "").
          // For mid-line case, the surrounding text is part of adjacent TEXT tokens.
          parts.push(tok.text);
        } else {
          // Non-matching platform: strip the marker.
          if (tok.wholeLine) {
            // Strip entire line. The linePrefix (leading whitespace before the
            // marker) is at the end of the previous TEXT token. We need to
            // trim back the previous TEXT token to the last newline, and also
            // eat the trailing newline of this line.
            parts.push({ eatLinePrefix: true, eatLeadingNewline: true });
          }
          // For mid-line non-whole-line: just don't push anything.
          // The surrounding text is in adjacent TEXT tokens and stays intact.
        }
        break;
      }

      default:
        throw new Error(`expand-templates: unknown token type ${tok.type}`);
    }
  }

  if (stack.length > 0) {
    const unclosed = stack.map((f) => `<<DO:IF ${f.platform}>>`).join(", ");
    throw new Error(
      `expand-templates: unclosed conditional block(s): ${unclosed}`
    );
  }

  // Now resolve the parts array into a final string.
  // Instructions:
  //   { eatLeadingNewline: true } — eat one leading newline from the NEXT text part
  //   { eatLinePrefix: true, eatLeadingNewline: true } — also eat trailing content
  //     of the PREVIOUS text part back to (and including) its last newline character,
  //     then eat leading newline of next text part.

  let result = "";
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (typeof part === "string") {
      result += part;
    } else if (part.eatLinePrefix && part.eatLeadingNewline) {
      // Trim result back to last newline (exclusive), removing the line prefix
      const lastNL = result.lastIndexOf("\n");
      if (lastNL !== -1) {
        result = result.slice(0, lastNL + 1); // keep the \n that ended prev line
      } else {
        // No newline found — the prefix is the entire result so far, clear it
        result = "";
      }
      // Also signal next string part to eat its leading newline
      // Find next string part and trim its leading \n
      for (let j = i + 1; j < parts.length; j++) {
        if (typeof parts[j] === "string") {
          if (parts[j].startsWith("\n")) {
            parts[j] = parts[j].slice(1);
          } else if (parts[j].startsWith("\r\n")) {
            parts[j] = parts[j].slice(2);
          }
          break;
        }
        // If another instruction, skip it (it'll be handled in turn)
      }
    } else if (part.eatLeadingNewline) {
      // Find next string part and eat its leading newline
      for (let j = i + 1; j < parts.length; j++) {
        if (typeof parts[j] === "string") {
          if (parts[j].startsWith("\r\n")) {
            parts[j] = parts[j].slice(2);
          } else if (parts[j].startsWith("\n")) {
            parts[j] = parts[j].slice(1);
          }
          break;
        }
      }
    }
  }

  return result;
}

/**
 * Expand a template string for the given platform.
 *
 * @param {string} content - Template content with <<DO:...>> markers
 * @param {'claude'|'codex'} platform
 * @returns {string} Expanded content for the platform
 */
function expandTemplate(content, platform) {
  if (!PLATFORMS.includes(platform)) {
    throw new Error(
      `expand-templates: invalid platform "${platform}" — expected "claude" or "codex"`
    );
  }
  const tokens = tokenize(content);
  return expandTokens(tokens, platform);
}

/**
 * Expand a template file and write the result to a destination path.
 *
 * @param {string} srcPath  - Path to the template file
 * @param {string} destPath - Path to write the expanded file
 * @param {'claude'|'codex'} platform
 */
function expandFile(srcPath, destPath, platform) {
  const content = fs.readFileSync(srcPath, "utf8");
  const expanded = expandTemplate(content, platform);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, expanded, "utf8");
}

module.exports = { expandTemplate, expandFile };
