#!/usr/bin/env node
"use strict";

// Turn a recipe-check JSON report into nice GitHub-native output:
//   1. inline annotations (::error/::warning) so each diagnostic shows on the
//      file in the PR "Files changed" tab and the checks UI,
//   2. a Markdown job-summary table on the run's Summary page,
//   3. a readable per-diagnostic listing in the step log,
// then exit non-zero when the recipe is invalid so the job fails.

const fs = require("fs");

const reportPath = process.argv[2];
const recipeDirRaw = process.env.RECIPE_DIR || ".";
const recipeDir =
  recipeDirRaw && recipeDirRaw !== "." ? recipeDirRaw.replace(/\/+$/, "") : "";

const oneLine = (value) =>
  String(value == null ? "" : value)
    .replace(/\r?\n/g, " ")
    .trim();

function annotate(command, message) {
  console.log(`::${command}::${message}`);
}

let report;
try {
  report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
} catch (err) {
  annotate(
    "error",
    `pi-recipes-action: could not read the recipe-check report (${oneLine(
      err.message
    )}). The checker may have crashed before producing output.`
  );
  process.exit(1);
}

const diagnostics = Array.isArray(report.diagnostics) ? report.diagnostics : [];
const errors = diagnostics.filter((d) => d.severity === "error");
const warnings = diagnostics.filter((d) => d.severity === "warning");
const valid = report.valid !== false && errors.length === 0;
const pkg = report.package_name || "<unknown recipe>";
const fileOf = (d) =>
  d.path ? (recipeDir ? `${recipeDir}/${d.path}` : d.path) : "";
const locOf = (d) => {
  const file = fileOf(d);
  if (!file) return "";
  return d.span && d.span.line ? `${file}:${d.span.line}` : file;
};

// 1. Inline annotations.
for (const d of diagnostics) {
  const command = d.severity === "error" ? "error" : "warning";
  const props = [];
  const file = fileOf(d);
  if (file) props.push(`file=${file}`);
  if (d.span && d.span.line) props.push(`line=${d.span.line}`);
  if (d.span && d.span.column) props.push(`col=${d.span.column}`);
  if (d.code) props.push(`title=${oneLine(d.code)}`);
  const message = d.help
    ? `${oneLine(d.message)} — ${oneLine(d.help)}`
    : oneLine(d.message);
  console.log(`::${command} ${props.join(",")}::${message}`);
}

// 2. Job summary.
const cell = (value) =>
  String(value == null ? "" : value)
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ");
const md = [];
md.push(`## Pi recipe check — ${valid ? "✅ passed" : "❌ failed"}`);
md.push("");
md.push(
  `**Recipe:** \`${cell(pkg)}\` &nbsp;·&nbsp; ` +
    `**Errors:** ${errors.length} &nbsp;·&nbsp; ` +
    `**Warnings:** ${warnings.length} &nbsp;·&nbsp; ` +
    `**Profile:** \`${cell(report.profile || "")}\``
);
md.push("");
if (diagnostics.length) {
  md.push("| Severity | Code | Location | Message |");
  md.push("| --- | --- | --- | --- |");
  for (const d of diagnostics) {
    const icon = d.severity === "error" ? "🔴 error" : "🟡 warning";
    md.push(
      `| ${icon} | \`${cell(d.code)}\` | \`${cell(locOf(d) || "—")}\` | ${cell(
        d.message
      )} |`
    );
  }
} else {
  md.push("No diagnostics. 🎉");
}
const resources = report.resources || {};
const resStr = Object.keys(resources)
  .map((key) => `${key}: ${resources[key]}`)
  .join(" · ");
if (resStr) {
  md.push("");
  md.push(`**Resources:** ${resStr}`);
}
md.push("");
if (process.env.GITHUB_STEP_SUMMARY) {
  try {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md.join("\n") + "\n");
  } catch {
    // A missing summary file is non-fatal; annotations still convey the result.
  }
}

// 3. Readable log listing.
console.log(`\nPi recipe check — ${pkg} (profile: ${report.profile || "?"})`);
for (const d of diagnostics) {
  const where = locOf(d);
  console.log(
    `  ${d.severity}: ${d.code}: ${oneLine(d.message)}${
      where ? ` (${where})` : ""
    }`
  );
  if (d.help) console.log(`    help: ${oneLine(d.help)}`);
}
if (resStr) console.log(`  resources: ${resStr}`);
console.log(
  `\n${valid ? "PASS" : "FAIL"}: ${errors.length} error(s), ${
    warnings.length
  } warning(s)`
);

process.exit(valid ? 0 : 1);
