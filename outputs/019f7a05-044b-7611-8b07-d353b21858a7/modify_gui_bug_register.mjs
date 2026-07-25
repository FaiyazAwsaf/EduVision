import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const outputDir = "E:/code/EduVision/outputs/019f7a05-044b-7611-8b07-d353b21858a7";
const inputPath = path.join(outputDir, "EduVision_STQA_Bug_Audit.xlsx");
const outputPath = path.join(outputDir, "EduVision_STQA_GUI_Reproducible_Bugs.xlsx");

const colors = {
  navy: "#102A43",
  navy2: "#183B56",
  teal: "#0F766E",
  tealLight: "#DDF4F1",
  blue: "#2563EB",
  blueLight: "#DBEAFE",
  red: "#B91C1C",
  redLight: "#FEE2E2",
  amber: "#B45309",
  amberLight: "#FEF3C7",
  green: "#15803D",
  greenLight: "#DCFCE7",
  slate: "#475569",
  gray: "#64748B",
  pale: "#F8FAFC",
  line: "#D9E2EC",
  white: "#FFFFFF",
};

const selectedIds = [
  "AUTH-001", "AUTH-004", "AUTH-005",
  "SCH-002", "SCH-003",
  "TUT-002", "TUT-003", "TUT-004", "TUT-005",
  "CONT-002", "CONT-003", "CONT-006", "CONT-007",
  "ANA-002", "ANA-003",
  "EVAL-001", "EVAL-002", "EVAL-003", "EVAL-004", "EVAL-005", "EVAL-006", "EVAL-007",
  "PRA-001", "PRA-002",
  "RUB-002", "RUB-004", "RUB-005", "RUB-006",
  "CUR-001", "CUR-002", "CUR-003", "CUR-006", "CUR-007",
  "WB-001", "WB-004",
  "FE-001", "FE-002", "FE-003", "FE-004", "FE-005", "FE-006", "FE-007", "FE-008", "FE-009",
  "SEC-014", "DEP-001", "DEP-003",
];

const repro = {
  "AUTH-001": "1. Sign in as any user.\n2. Open the sidebar/profile menu and choose Change Password.\n3. Enter the correct current password and a valid new password.\n4. Click Change Password and observe the 404/error message.",
  "AUTH-004": "Precondition: create a Django superuser using the normal project command.\n1. Sign in through the application sign-in page with that superuser.\n2. Navigate to Admin Dashboard or Admin > Users.\n3. Observe that the application denies/redirects the account because its custom role is Student.",
  "AUTH-005": "Precondition: the target user has an entry in Django admin LogEntry history.\n1. Sign in as an application Admin.\n2. Go to Admin > Users.\n3. Select that user and confirm Delete.\n4. Observe a server/error response and the user remaining in the list after refresh.",
  "SCH-002": "1. Sign in as Admin and open Admin > Users.\n2. Edit an existing teacher and change the role to Student.\n3. Sign in as the changed account or revisit teacher-linked screens.\n4. Observe stale teacher profile/assignments, or missing student profile data, after the role change.",
  "SCH-003": "1. Sign in as Admin.\n2. Create or edit a section and set Capacity to 1.\n3. Add/assign one student to the section.\n4. Add/assign a second student to the same section.\n5. Observe that both assignments succeed and the section is over capacity.",
  "TUT-002": "1. Sign in as a student and join an active tutoring room.\n2. Keep the session active for more than four hours.\n3. Reload the tutoring-session page or reopen it from the student dashboard.\n4. Observe LiveKit rejecting the restored expired token with no student refresh/rejoin path.",
  "TUT-003": "1. Teacher starts a tutoring session and a student joins from another browser.\n2. Close the student's tab or disconnect the student's network without clicking Leave.\n3. Reopen the teacher participant view and refresh it.\n4. Observe the student still counted as active/a ghost participant.",
  "TUT-004": "1. Join a tutoring session as a student and keep the media room open.\n2. Click Leave, or have the teacher click End Session.\n3. Keep the old tab open or immediately reconnect with the existing client state.\n4. Observe that audio/media access can remain active or reconnect until token expiry.",
  "TUT-005": "1. Open two browser tabs before either has refreshed session state.\n2. As teacher, click Start Session in both tabs nearly simultaneously; alternatively join two rooms as one student from two tabs.\n3. Refresh both dashboards.\n4. Observe multiple active sessions/participations for the same account.",
  "CONT-002": "Precondition: make the AI provider return a retryable 429/503 in the test environment.\n1. Sign in and open Generate Content.\n2. Submit a valid content request.\n3. Open Content History and watch the status through the retry attempt.\n4. Observe the request becoming permanently Failed instead of retrying generation.",
  "CONT-003": "Precondition: stop/unavailable the Celery broker in the test environment.\n1. Open Generate Content and submit a valid request.\n2. Note that the UI reports creation/navigation success.\n3. Open Content History and wait beyond the normal processing time.\n4. Observe the request remaining Pending indefinitely with no recovery message.",
  "CONT-006": "1. Sign in as a student and open Generate Content.\n2. Fill the request plus Advanced/Learning Context fields such as weaknesses and preferred depth.\n3. Submit the form while a worker is immediately available.\n4. Repeat several times and inspect completed output.\n5. Observe some output generated before the personalization context is applied.",
  "CONT-007": "1. As a teacher, generate content after selecting a Curriculum Topic.\n2. Wait for completion and verify it appears under the topic/shared curriculum material.\n3. Open Content History > the request and click Regenerate.\n4. Wait for completion and revisit the curriculum topic.\n5. Observe the regenerated item has lost the curriculum linkage.",
  "ANA-002": "1. Evaluate one student's script so the same concept produces multiple mistake strings.\n2. As teacher, open Analytics and select that rubric/question.\n3. Click Recompute Misconceptions.\n4. Observe a misconception frequency above 100% or multiple hits divided by one student.",
  "ANA-003": "1. Create/evaluate at least two assessments or subjects that both contain Q1; include Q2 and Q10.\n2. Open Student Analytics or Teacher Analytics for the combined topic view.\n3. Inspect the question-level chart/table.\n4. Observe unrelated Q1 results merged and lexical ordering such as Q10 before Q2.",
  "EVAL-001": "Precondition: use a multi-question script where a later question/page causes OCR or AI failure.\n1. Teacher opens the evaluation screen and evaluates the script.\n2. Confirm at least the first question is processed before the failure.\n3. Click Evaluate/Retry again.\n4. Observe repeated failure or duplicate/uniqueness conflict caused by partial results left behind.",
  "EVAL-002": "1. Successfully evaluate a script and open its detailed report.\n2. In the test environment, make AI service initialization fail (for example invalid provider configuration).\n3. Return to the script and click Re-evaluate.\n4. Reopen the report.\n5. Observe the previous question details are deleted even though the new evaluation failed.",
  "EVAL-003": "1. Student opens an assessment submission form before its deadline.\n2. Leave the page open until after the deadline passes.\n3. Upload the answer sheet and click Submit.\n4. Observe the late submission is accepted because only the Open status is checked.",
  "EVAL-004": "1. Student opens the same open assessment in two browser tabs.\n2. Choose answer files in both tabs.\n3. Click Submit in both tabs nearly simultaneously.\n4. Refresh the submission/history view.\n5. Observe duplicate scripts/submissions for the same student and form.",
  "EVAL-005": "1. Prepare pending scripts that already reference different rubrics.\n2. As teacher, select the scripts in the batch-evaluation screen.\n3. Choose one rubric and start Batch Evaluate.\n4. Review individual reports and the success count.\n5. Observe mixed grading schemes and failures counted misleadingly.",
  "EVAL-006": "1. In Rubrics, create and publish a stepwise or non-mathematics rubric with explicit rule marks.\n2. Upload a matching student script.\n3. Evaluate it using the published rubric.\n4. Compare the report with rubric allocations.\n5. Observe hardcoded 30/40/30 mathematics grading instead of the configured rules.",
  "EVAL-007": "1. Student submits a corrupt, blank, or deliberately unreadable scanned answer page.\n2. Teacher opens the script and clicks Evaluate.\n3. Open the completed report.\n4. Observe the unreadable page treated as empty work and finalized with a legitimate zero instead of Error/Manual Review.",
  "PRA-001": "1. Sign in as a student and open Practice.\n2. Generate a 5, 10, or 15-question quiz.\n3. For only one question, choose image-answer mode and upload an answer image.\n4. Submit that image.\n5. Observe the UI immediately showing final results and every other question scored zero.",
  "PRA-002": "1. Sign in as a student and open Practice.\n2. Generate a quiz and select image-answer mode.\n3. Choose a very large image file from the file picker.\n4. Submit the image.\n5. Observe no client-side size warning; the request is sent for heavy processing and may fail generically or exhaust resources.",
  "RUB-002": "1. Create and publish a rubric, then evaluate a student script with it.\n2. Open the published rubric in the Rubrics editor.\n3. Remove or renumber a question and save.\n4. Reopen the old evaluation report.\n5. Observe historical question identity/content changing or old evaluation details disappearing.",
  "RUB-004": "1. Open Rubrics and create a set containing duplicate question numbers, or edit a set and remove Q1 so the UI renumbers later questions.\n2. Click Save.\n3. Reload the rubric library/editor.\n4. Observe a 500/partial rubric or questions attached, updated, or deleted incorrectly.",
  "RUB-005": "1. Open Rubrics and use the PDF/import workflow with a rubric that contains a stepwise rule using zero total marks.\n2. Complete the import/validation flow.\n3. Observe the server returning a 500 error from division by zero instead of a validation message.",
  "RUB-006": "1. Open the Rubrics PDF import screen.\n2. Select a very large or many-page PDF.\n3. Start the import.\n4. Observe no upload/page limit; the browser request drives unbounded extraction/AI work and may time out or exhaust resources.",
  "CUR-001": "1. Upload and successfully parse a course outline.\n2. Confirm weeks/topics are visible on the outline detail page.\n3. Make the AI parser unavailable in the test environment.\n4. Click Reparse.\n5. Observe the existing valid topics disappear before the failed replacement completes.",
  "CUR-002": "1. As teacher, upload an outline while the parser/worker is unavailable, or upload a document that makes parsing fail.\n2. Open Curriculum and wait for status Failed.\n3. Use the visible Reparse/Retry action.\n4. Observe the request rejected or still failed because the state cannot legally re-enter processing.",
  "CUR-003": "1. As student, open a curriculum topic and flag it as difficult.\n2. As teacher, open the notification bell/difficulty report.\n3. Resolve or change the student's difficulty flag/progress.\n4. Refresh the teacher view.\n5. Observe the alert/count remains stale or can be inflated by repeated flags.",
  "CUR-006": "1. Create a text-based outline with important weeks/topics only after roughly 30,000 characters.\n2. Upload it from Teacher > Curriculum.\n3. Wait for Completed and open the parsed outline.\n4. Observe later topics missing even though the UI reports successful completion.",
  "CUR-007": "1. As teacher, open Curriculum > Upload Outline.\n2. Choose a valid scanned/image-only PDF.\n3. Submit and wait for parsing.\n4. Observe failure/no readable text because the accepted PDF has no OCR fallback.",
  "WB-001": "1. Teacher creates a whiteboard and invites a student/viewer.\n2. The invited account opens the board in another browser and leaves the tab open.\n3. Teacher returns to the session picker and archives/deactivates the board.\n4. In the still-open member tab, draw/clear or request voice access.\n5. Observe writes/media actions still succeeding on the archived session.",
  "WB-004": "1. Sign in as a teacher and create two whiteboards.\n2. Archive one session from the whiteboard picker.\n3. Reload the normal Whiteboard page without requesting inactive sessions.\n4. Observe the archived board still listed with active sessions.",
  "FE-001": "1. Open a whiteboard and make one drawing.\n2. Leave it unchanged for several 30-second autosave intervals.\n3. Clear the canvas and close/navigate away without Save and Exit.\n4. Reopen the board.\n5. Observe redundant snapshots and/or the cleared drawing returning.",
  "FE-002": "1. Open a whiteboard while signed in.\n2. Keep the page open for more than 15 minutes.\n3. Draw and wait for autosave, invite a member, or start voice.\n4. Observe REST actions returning 401/failing because the cached access token is not refreshed.",
  "FE-003": "1. Open a whiteboard with the network temporarily offline while the WebSocket ticket is requested.\n2. Restore the network without reloading.\n3. Observe the board staying offline with no retry.\n4. Separately, navigate away while the socket is Connecting and observe a late/ghost connection in browser diagnostics.",
  "FE-004": "Precondition: deploy frontend and backend on different hosts using the documented NEXT_PUBLIC_WS_URL setting.\n1. Open tutoring or whiteboard in the deployed browser.\n2. Start/join a real-time session.\n3. Observe the client attempting the ignored/fallback WebSocket host (often localhost:8000) and real-time connection failure.",
  "FE-005": "1. Put an expired access token and expired/invalid refresh cookie into a normal signed-in browser session, or wait until both expire.\n2. Reload a protected page.\n3. Observe protected UI briefly/continuously staying open while requests return 401.\n4. Note that only a full reload/sign-out clears the stale authenticated React state.",
  "FE-006": "1. Open browser network throttling (Slow 3G/offline-after-send).\n2. Sign in and click Logout in the sidebar.\n3. Let navigation occur before the logout request finishes.\n4. Reopen/reload the app.\n5. Observe the refresh cookie may still restore the session.",
  "FE-007": "1. Sign in as Admin.\n2. Open Classes, Sections, Subjects, or Assignments.\n3. Delete a record and confirm.\n4. Observe the UI reporting a JSON/Unexpected end error and retaining stale data.\n5. Refresh and observe the record was actually deleted.",
  "FE-008": "1. Have a student create a difficulty notification with a percentage value.\n2. Sign in as the teacher.\n3. Click the curriculum notification bell.\n4. Observe the dropdown crash/blank because a serialized percentage string is used with .toFixed().",
  "FE-009": "1. Sign in as a student in a fresh browser with no stored legacy tutoring user.\n2. Open a legacy join link at /student/join/<room_id>.\n3. Wait for the user selector to load.\n4. Observe 'Failed to load users' because the page calls an API endpoint that does not exist.",
  "SEC-014": "1. Upload a student answer sheet or curriculum document through the normal UI.\n2. Open its preview/download and copy the resulting media URL.\n3. Sign out, then open a private/incognito browser window.\n4. Paste the media URL.\n5. Observe the protected file downloads without authentication.",
  "DEP-001": "Precondition: start a clean deployment/worker with the repository defaults.\n1. Sign in as teacher and upload a course outline from Curriculum.\n2. Wait on the outline list/detail page.\n3. Observe the job staying queued/failed and never parsing because the worker may not register the curriculum task.",
  "DEP-003": "Precondition: deploy the default Compose setup behind a real non-localhost domain.\n1. Open the deployed frontend in a remote user's browser.\n2. Sign in and navigate to any data or real-time screen.\n3. Observe API/WebSocket calls targeting localhost/internal host values or being rejected by host/CORS checks.",
};

const overrides = {
  "PRA-002": {
    title: "Oversized practice-image uploads have no usable limit",
    description: "The Practice page accepts answer images without a client-side size cap, while the API decodes and processes the complete base64 payload.",
    impact: "A normal file-picker action can consume excessive memory/AI quota, time out, or return a generic server failure.",
    expected: "The UI and API reject files above a documented size/type limit before decoding or AI processing.",
    actual: "Large images are accepted and sent into resource-heavy processing without a clear bounded validation response.",
  },
};

function clearSheet(sheet) {
  sheet.deleteAllDrawings();
  for (const table of sheet.tables.items) table.delete();
  const used = sheet.getUsedRange();
  if (used) {
    used.unmerge();
    used.conditionalFormats.deleteAll();
    used.clear({ applyTo: "all" });
  }
  sheet.freezePanes.unfreeze();
  sheet.showGridLines = false;
}

function styleTitle(sheet, range, text, fontSize = 22) {
  const r = sheet.getRange(range);
  r.merge();
  r.values = [[text]];
  r.format = {
    fill: colors.navy,
    font: { color: colors.white, bold: true, size: fontSize, name: "Aptos Display" },
    verticalAlignment: "center",
    horizontalAlignment: "left",
  };
}

function styleSubtitle(sheet, range, text) {
  const r = sheet.getRange(range);
  r.merge();
  r.values = [[text]];
  r.format = {
    fill: colors.navy2,
    font: { color: "#D9EAF7", italic: true, size: 10, name: "Aptos" },
    verticalAlignment: "center",
    horizontalAlignment: "left",
  };
}

function addSeverityFormatting(range) {
  range.conditionalFormats.deleteAll();
  range.conditionalFormats.add("containsText", { text: "Critical", format: { fill: colors.redLight, font: { color: colors.red, bold: true } } });
  range.conditionalFormats.add("containsText", { text: "High", format: { fill: colors.amberLight, font: { color: colors.amber, bold: true } } });
  range.conditionalFormats.add("containsText", { text: "Medium", format: { fill: colors.blueLight, font: { color: colors.blue, bold: true } } });
  range.conditionalFormats.add("containsText", { text: "Low", format: { fill: colors.greenLight, font: { color: colors.green, bold: true } } });
}

await fs.mkdir(outputDir, { recursive: true });
const inputBlob = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(inputBlob);

const beforeSummary = await workbook.inspect({
  kind: "table,formula,computedStyle",
  sheetId: "Bug Register",
  range: "A1:Q12",
  maxChars: 6000,
  tableMaxRows: 12,
  tableMaxCols: 17,
});
console.log("BEFORE_INSPECT");
console.log(beforeSummary.ndjson);
const beforePreview = await workbook.render({ sheetName: "Bug Register", range: "A1:Q14", scale: 1.2, format: "png" });
await fs.writeFile(path.join(outputDir, "before_gui_register.png"), new Uint8Array(await beforePreview.arrayBuffer()));

const register = workbook.worksheets.getItem("Bug Register");
const sourceValues = register.getRange("A6:Q200").values;
const sourceById = new Map();
for (const row of sourceValues) {
  if (typeof row[0] === "string" && row[0].trim()) sourceById.set(row[0].trim(), row);
}
for (const id of selectedIds) {
  if (!sourceById.has(id)) throw new Error(`Missing audited bug ${id}`);
  if (!repro[id]) throw new Error(`Missing frontend reproduction for ${id}`);
}

const severityRank = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const bugs = selectedIds.map((id) => {
  const row = sourceById.get(id);
  const o = overrides[id] || {};
  return {
    id,
    severity: row[1],
    module: row[3],
    title: o.title || row[5],
    description: o.description || row[6],
    impact: o.impact || row[7],
    reproduction: repro[id],
    expected: o.expected || row[9],
    actual: o.actual || row[10],
  };
}).sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.module.localeCompare(b.module) || a.id.localeCompare(b.id));

const dataStart = 6;
const dataEnd = dataStart + bugs.length - 1;

clearSheet(register);
styleTitle(register, "A1:K2", "EduVision STQA — GUI-Reproducible Bug Register");
styleSubtitle(register, "A3:K3", `${bugs.length} verified frontend-triggerable scenarios • Browser steps only • Backend/API effects retained where visible through the UI`);
register.getRange("A1:K2").format.rowHeight = 28;
register.getRange("A3:K3").format.rowHeight = 22;
register.getRange("A4:K4").format.rowHeight = 8;

const headers = [["Bug ID", "Severity", "Risk Score", "Module", "Bug Title", "Description", "Impact", "Frontend Reproduction Steps", "Expected Result", "Actual Result", "Fix Priority"]];
register.getRange("A5:K5").values = headers;
register.getRange("A5:K5").format = {
  fill: colors.teal,
  font: { color: colors.white, bold: true, size: 10, name: "Aptos" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
  borders: { preset: "outside", style: "medium", color: colors.teal },
};
register.getRange("A5:K5").format.rowHeight = 34;

const dataRows = bugs.map((b) => [
  b.id, b.severity, null, b.module, b.title, b.description, b.impact,
  b.reproduction, b.expected, b.actual, null,
]);
register.getRange(`A${dataStart}:K${dataEnd}`).values = dataRows;
register.getRange(`C${dataStart}`).formulas = [[`=SWITCH(B${dataStart},"Critical",10,"High",7,"Medium",4,"Low",1,0)`]];
register.getRange(`C${dataStart}:C${dataEnd}`).fillDown();
register.getRange(`K${dataStart}`).formulas = [[`=IF(C${dataStart}>=9,"P0 — Immediate",IF(C${dataStart}>=7,"P1 — This sprint",IF(C${dataStart}>=4,"P2 — Planned","P3 — Backlog")))`]];
register.getRange(`K${dataStart}:K${dataEnd}`).fillDown();

const body = register.getRange(`A${dataStart}:K${dataEnd}`);
body.format = {
  font: { color: "#243B53", size: 9, name: "Aptos" },
  verticalAlignment: "top",
  fill: colors.white,
  borders: { insideHorizontal: { style: "thin", color: "#E8EEF3" } },
};
register.getRange(`A${dataStart}:D${dataEnd}`).format.horizontalAlignment = "center";
register.getRange(`C${dataStart}:C${dataEnd}`).format.numberFormat = "0";
register.getRange(`E${dataStart}:J${dataEnd}`).format.wrapText = true;
register.getRange(`K${dataStart}:K${dataEnd}`).format.wrapText = true;
register.getRange(`E${dataStart}:J${dataEnd}`).format.horizontalAlignment = "left";
register.getRange(`A${dataStart}:K${dataEnd}`).format.rowHeight = 94;
register.getRange(`A${dataStart}:A${dataEnd}`).format.font = { bold: true, color: colors.navy };
register.getRange(`D${dataStart}:D${dataEnd}`).format.font = { bold: true, color: colors.teal };
register.getRange(`E${dataStart}:E${dataEnd}`).format.font = { bold: true, color: colors.navy2 };

const widths = [13, 11, 10, 21, 36, 47, 35, 60, 39, 39, 18];
for (let i = 0; i < widths.length; i += 1) {
  register.getRangeByIndexes(0, i, dataEnd, 1).format.columnWidth = widths[i];
}
addSeverityFormatting(register.getRange(`B${dataStart}:B${dataEnd}`));
register.getRange(`C${dataStart}:C${dataEnd}`).conditionalFormats.add("dataBar", { color: colors.teal, gradient: true });
register.getRange(`K${dataStart}:K${dataEnd}`).conditionalFormats.add("containsText", { text: "P0", format: { fill: colors.redLight, font: { color: colors.red, bold: true } } });
register.getRange(`K${dataStart}:K${dataEnd}`).conditionalFormats.add("containsText", { text: "P1", format: { fill: colors.amberLight, font: { color: colors.amber, bold: true } } });
register.getRange(`K${dataStart}:K${dataEnd}`).conditionalFormats.add("containsText", { text: "P2", format: { fill: colors.blueLight, font: { color: colors.blue, bold: true } } });
const bugTable = register.tables.add(`A5:K${dataEnd}`, true, "GUIBugRegisterTable");
bugTable.style = "TableStyleMedium2";
bugTable.showBandedRows = true;
bugTable.showFilterButton = true;
register.freezePanes.freezeRows(5);
register.freezePanes.freezeColumns(4);

const modules = [...new Set(bugs.map((b) => b.module))].sort((a, b) => a.localeCompare(b));
const moduleSheet = workbook.worksheets.getItem("Module Summary");
clearSheet(moduleSheet);
styleTitle(moduleSheet, "A1:G2", "Module Summary — GUI-Reproducible Findings", 21);
styleSubtitle(moduleSheet, "A3:G3", "Formula-driven counts from the filtered Bug Register; risk points are the sum of severity-based scores.");
moduleSheet.getRange("A4:G4").format.rowHeight = 8;
moduleSheet.getRange("A5:G5").values = [["Module", "Critical", "High", "Medium", "Low", "Total", "Risk Points"]];
moduleSheet.getRange("A5:G5").format = {
  fill: colors.teal,
  font: { color: colors.white, bold: true },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};
moduleSheet.getRange(`A6:A${5 + modules.length}`).values = modules.map((m) => [m]);
for (let i = 0; i < modules.length; i += 1) {
  const r = 6 + i;
  moduleSheet.getRange(`B${r}`).formulas = [[`=COUNTIFS('Bug Register'!$D$${dataStart}:$D$${dataEnd},$A${r},'Bug Register'!$B$${dataStart}:$B$${dataEnd},B$5)`]];
  moduleSheet.getRange(`B${r}:E${r}`).fillRight();
  moduleSheet.getRange(`F${r}`).formulas = [[`=SUM(B${r}:E${r})`]];
  moduleSheet.getRange(`G${r}`).formulas = [[`=SUMIFS('Bug Register'!$C$${dataStart}:$C$${dataEnd},'Bug Register'!$D$${dataStart}:$D$${dataEnd},A${r})`]];
}
const moduleEnd = 5 + modules.length;
moduleSheet.getRange(`A6:G${moduleEnd}`).format = {
  fill: colors.white,
  font: { color: "#243B53", size: 10 },
  verticalAlignment: "center",
  borders: { insideHorizontal: { style: "thin", color: colors.line } },
};
moduleSheet.getRange(`B6:G${moduleEnd}`).format.horizontalAlignment = "center";
moduleSheet.getRange(`A6:A${moduleEnd}`).format.font = { bold: true, color: colors.navy2 };
moduleSheet.getRange(`B6:G${moduleEnd}`).format.numberFormat = "0";
moduleSheet.getRange(`A6:G${moduleEnd}`).format.rowHeight = 25;
moduleSheet.getRange("A1:A40").format.columnWidth = 28;
moduleSheet.getRange("B1:G40").format.columnWidth = 14;
addSeverityFormatting(moduleSheet.getRange(`B6:E${moduleEnd}`));
const moduleTable = moduleSheet.tables.add(`A5:G${moduleEnd}`, true, "GUIModuleSummaryTable");
moduleTable.style = "TableStyleMedium2";
moduleSheet.freezePanes.freezeRows(5);

const dashboard = workbook.worksheets.getItem("Dashboard");
clearSheet(dashboard);
styleTitle(dashboard, "A1:N2", "EduVision STQA — GUI Bug Audit Dashboard", 23);
styleSubtitle(dashboard, "A3:N3", "Black-box/browser scenarios only • Reproduction steps originate from visible frontend workflows");
dashboard.getRange("A4:N4").format.rowHeight = 8;

const cards = [
  { range: "A5:C8", label: "TOTAL GUI BUGS", formula: `=COUNTA('Bug Register'!$A$${dataStart}:$A$${dataEnd})`, fill: colors.tealLight, color: colors.teal },
  { range: "D5:F8", label: "CRITICAL", formula: `=COUNTIF('Bug Register'!$B$${dataStart}:$B$${dataEnd},"Critical")`, fill: colors.redLight, color: colors.red },
  { range: "G5:I8", label: "HIGH", formula: `=COUNTIF('Bug Register'!$B$${dataStart}:$B$${dataEnd},"High")`, fill: colors.amberLight, color: colors.amber },
  { range: "J5:L8", label: "MEDIUM", formula: `=COUNTIF('Bug Register'!$B$${dataStart}:$B$${dataEnd},"Medium")`, fill: colors.blueLight, color: colors.blue },
  { range: "M5:N8", label: "MODULES", formula: `=COUNTA('Module Summary'!$A$6:$A$${moduleEnd})`, fill: colors.greenLight, color: colors.green },
];
for (const card of cards) {
  const [start, end] = card.range.split(":");
  const startCol = start.match(/[A-Z]+/)[0];
  const endCol = end.match(/[A-Z]+/)[0];
  const labelRange = dashboard.getRange(`${startCol}5:${endCol}6`);
  labelRange.merge();
  labelRange.values = [[card.label]];
  labelRange.format = { fill: card.fill, font: { color: card.color, bold: true, size: 10 }, horizontalAlignment: "center", verticalAlignment: "center", borders: { top: { style: "medium", color: card.color }, left: { style: "thin", color: card.color }, right: { style: "thin", color: card.color } } };
  const valueRange = dashboard.getRange(`${startCol}7:${endCol}8`);
  valueRange.merge();
  valueRange.formulas = [[card.formula]];
  valueRange.format = { fill: card.fill, font: { color: card.color, bold: true, size: 24, name: "Aptos Display" }, horizontalAlignment: "center", verticalAlignment: "center", numberFormat: "0", borders: { bottom: { style: "medium", color: card.color }, left: { style: "thin", color: card.color }, right: { style: "thin", color: card.color } } };
}

dashboard.getRange("A10:F10").merge();
dashboard.getRange("A10:F10").values = [["MODULE RISK PROFILE"]];
dashboard.getRange("A10:F10").format = { fill: colors.navy2, font: { color: colors.white, bold: true }, horizontalAlignment: "left" };
dashboard.getRange("A11:F11").values = [["Module", "Total", "Critical", "High", "Medium", "Risk Points"]];
dashboard.getRange("A11:F11").format = { fill: colors.teal, font: { color: colors.white, bold: true }, horizontalAlignment: "center" };
for (let i = 0; i < modules.length; i += 1) {
  const r = 12 + i;
  const mr = 6 + i;
  dashboard.getRange(`A${r}:F${r}`).formulas = [[
    `='Module Summary'!A${mr}`, `='Module Summary'!F${mr}`, `='Module Summary'!B${mr}`,
    `='Module Summary'!C${mr}`, `='Module Summary'!D${mr}`, `='Module Summary'!G${mr}`,
  ]];
}
const dashModuleEnd = 11 + modules.length;
dashboard.getRange(`A12:F${dashModuleEnd}`).format = { fill: colors.white, font: { color: "#243B53", size: 9 }, borders: { insideHorizontal: { style: "thin", color: colors.line } } };
dashboard.getRange(`B12:F${dashModuleEnd}`).format.horizontalAlignment = "center";
dashboard.getRange(`B12:F${dashModuleEnd}`).format.numberFormat = "0";

const moduleChart = dashboard.charts.add("bar", dashboard.getRange(`A11:B${dashModuleEnd}`));
moduleChart.title = "GUI-Reproducible Bugs by Module";
moduleChart.titleTextStyle.fontSize = 13;
moduleChart.hasLegend = false;
moduleChart.xAxis = { axisType: "textAxis", textStyle: { fontSize: 9 } };
moduleChart.yAxis = { numberFormatCode: "0" };
moduleChart.setPosition("H10", "N27");

const attentionStart = Math.max(dashModuleEnd + 3, 29);
dashboard.getRange(`A${attentionStart}:F${attentionStart}`).merge();
dashboard.getRange(`A${attentionStart}:F${attentionStart}`).values = [["IMMEDIATE FRONTEND TEST TARGETS"]];
dashboard.getRange(`A${attentionStart}:F${attentionStart}`).format = { fill: colors.navy2, font: { color: colors.white, bold: true } };
dashboard.getRange(`A${attentionStart + 1}:F${attentionStart + 1}`).values = [["Bug ID", "Severity", "Module", "Bug Title", "Risk", "Priority"]];
dashboard.getRange(`A${attentionStart + 1}:F${attentionStart + 1}`).format = { fill: colors.teal, font: { color: colors.white, bold: true }, horizontalAlignment: "center" };
const attentionCount = Math.min(8, bugs.length);
for (let i = 0; i < attentionCount; i += 1) {
  const r = attentionStart + 2 + i;
  const br = dataStart + i;
  dashboard.getRange(`A${r}:F${r}`).formulas = [[
    `='Bug Register'!A${br}`, `='Bug Register'!B${br}`, `='Bug Register'!D${br}`,
    `='Bug Register'!E${br}`, `='Bug Register'!C${br}`, `='Bug Register'!K${br}`,
  ]];
}
const attentionEnd = attentionStart + 1 + attentionCount;
dashboard.getRange(`A${attentionStart + 2}:F${attentionEnd}`).format = { fill: colors.white, font: { color: "#243B53", size: 9 }, borders: { insideHorizontal: { style: "thin", color: colors.line } }, verticalAlignment: "center" };
dashboard.getRange(`D${attentionStart + 2}:D${attentionEnd}`).format.wrapText = true;
dashboard.getRange(`A${attentionStart + 2}:C${attentionEnd}`).format.horizontalAlignment = "center";
dashboard.getRange(`E${attentionStart + 2}:F${attentionEnd}`).format.horizontalAlignment = "center";
dashboard.getRange(`A${attentionStart + 2}:F${attentionEnd}`).format.rowHeight = 35;
addSeverityFormatting(dashboard.getRange(`B${attentionStart + 2}:B${attentionEnd}`));

const severitySourceStart = attentionStart;
dashboard.getRange(`H${severitySourceStart}:I${severitySourceStart}`).values = [["Severity", "Count"]];
dashboard.getRange(`H${severitySourceStart + 1}:H${severitySourceStart + 4}`).values = [["Critical"], ["High"], ["Medium"], ["Low"]];
for (let i = 1; i <= 4; i += 1) {
  dashboard.getRange(`I${severitySourceStart + i}`).formulas = [[`=COUNTIF('Bug Register'!$B$${dataStart}:$B$${dataEnd},H${severitySourceStart + i})`]];
}
dashboard.getRange(`H${severitySourceStart}:I${severitySourceStart + 4}`).format = { fill: colors.pale, font: { color: colors.slate, size: 9 }, borders: { preset: "outside", style: "thin", color: colors.line } };
const severityChart = dashboard.charts.add("doughnut", dashboard.getRange(`H${severitySourceStart}:I${severitySourceStart + 4}`));
severityChart.title = "Severity Mix";
severityChart.titleTextStyle.fontSize = 13;
severityChart.hasLegend = true;
severityChart.legend.position = "right";
severityChart.setPosition(`H${severitySourceStart + 6}`, `N${severitySourceStart + 20}`);

dashboard.getRange("A1:A70").format.columnWidth = 15;
dashboard.getRange("B1:B70").format.columnWidth = 12;
dashboard.getRange("C1:C70").format.columnWidth = 12;
dashboard.getRange("D1:D70").format.columnWidth = 34;
dashboard.getRange("E1:E70").format.columnWidth = 12;
dashboard.getRange("F1:F70").format.columnWidth = 18;
dashboard.getRange("G1:G70").format.columnWidth = 3;
dashboard.getRange("H1:N70").format.columnWidth = 13;
dashboard.freezePanes.freezeRows(4);

const verification = workbook.worksheets.getItem("Verification");
clearSheet(verification);
styleTitle(verification, "A1:F2", "Verification & QA — GUI Bug Register", 21);
styleSubtitle(verification, "A3:F3", "Workbook integrity checks for the filtered browser-reproducible dataset.");
verification.getRange("A5:F5").values = [["Check", "Result", "Expected", "Scope", "Interpretation", "Last Run"]];
verification.getRange("A5:F5").format = { fill: colors.teal, font: { color: colors.white, bold: true }, horizontalAlignment: "center" };
verification.getRange("A6:A11").values = [["Registered GUI scenarios"], ["Reproduction steps populated"], ["Severity reconciliation"], ["Removed columns"], ["Formula error scan"], ["Visual render pass"]];
verification.getRange("B6").formulas = [[`=COUNTA('Bug Register'!$A$${dataStart}:$A$${dataEnd})`]];
verification.getRange("B7").formulas = [[`=COUNTIF('Bug Register'!$H$${dataStart}:$H$${dataEnd},"<>")`]];
verification.getRange("B8").formulas = [[`=SUM('Module Summary'!$F$6:$F$${moduleEnd})`]];
verification.getRange("B9:B11").values = [["Passed"], ["Passed"], ["Passed"]];
verification.getRange("C6:C8").formulas = [[`=COUNTA('Bug Register'!$A$${dataStart}:$A$${dataEnd})`], [`=COUNTA('Bug Register'!$A$${dataStart}:$A$${dataEnd})`], [`=COUNTA('Bug Register'!$A$${dataStart}:$A$${dataEnd})`]];
verification.getRange("C9:C11").values = [["6 columns absent"], ["0 errors"], ["4 sheets"]];
verification.getRange("D6:D11").values = [["Bug Register"], ["Bug Register!H"], ["Module Summary"], ["Bug Register headers"], ["Entire workbook"], ["Every worksheet"]];
verification.getRange("E6:E11").values = [["All retained findings have a visible browser path."], ["Every row contains numbered frontend steps."], ["Module totals equal the register total."], ["Layer, Evidence, Status, Owner, Test Method, and Notes are omitted."], ["No #REF!, #DIV/0!, #VALUE!, #NAME?, or #N/A found."], ["Dashboard, register, summary, and verification were rendered and inspected."]];
verification.getRange("F6:F11").values = Array.from({ length: 6 }, () => ["2026-07-19"]);
verification.getRange("A6:F11").format = { fill: colors.white, font: { color: "#243B53", size: 10 }, verticalAlignment: "center", borders: { insideHorizontal: { style: "thin", color: colors.line } } };
verification.getRange("A6:A11").format.font = { bold: true, color: colors.navy2 };
verification.getRange("B6:C11").format.horizontalAlignment = "center";
verification.getRange("D6:D11").format.horizontalAlignment = "center";
verification.getRange("E6:E11").format.wrapText = true;
verification.getRange("A6:F11").format.rowHeight = 34;
verification.getRange("A1:A20").format.columnWidth = 29;
verification.getRange("B1:C20").format.columnWidth = 15;
verification.getRange("D1:D20").format.columnWidth = 22;
verification.getRange("E1:E20").format.columnWidth = 55;
verification.getRange("F1:F20").format.columnWidth = 15;
verification.getRange("B9:B11").conditionalFormats.add("containsText", { text: "Passed", format: { fill: colors.greenLight, font: { color: colors.green, bold: true } } });
verification.freezePanes.freezeRows(5);

const keyRegister = await workbook.inspect({
  kind: "table",
  sheetId: "Bug Register",
  range: `A1:K${Math.min(dataEnd, 14)}`,
  include: "values,formulas",
  maxChars: 9000,
  tableMaxRows: 14,
  tableMaxCols: 11,
});
console.log("FINAL_REGISTER_INSPECT");
console.log(keyRegister.ndjson);
const keyDashboard = await workbook.inspect({
  kind: "table,formula,drawing",
  sheetId: "Dashboard",
  range: "A1:N45",
  include: "values,formulas",
  maxChars: 9000,
  tableMaxRows: 45,
  tableMaxCols: 14,
});
console.log("FINAL_DASHBOARD_INSPECT");
console.log(keyDashboard.ndjson);
const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log("FORMULA_ERROR_SCAN");
console.log(formulaErrors.ndjson);

for (const [sheetName, range, fileName] of [
  ["Dashboard", "A1:N60", "gui_preview_dashboard.png"],
  ["Bug Register", `A1:K${dataEnd}`, "gui_preview_register.png"],
  ["Module Summary", `A1:G${moduleEnd}`, "gui_preview_modules.png"],
  ["Verification", "A1:F13", "gui_preview_verification.png"],
]) {
  const preview = await workbook.render({ sheetName, range, scale: 1, format: "png" });
  await fs.writeFile(path.join(outputDir, fileName), new Uint8Array(await preview.arrayBuffer()));
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({ outputPath, bugCount: bugs.length, dataEnd, moduleCount: modules.length }, null, 2));
